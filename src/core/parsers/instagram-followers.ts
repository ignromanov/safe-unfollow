/**
 * Instagram Followers Parser
 * Handles multi-file followers_*.json parsing with dedup
 */

import type { FileExpectation, InstagramExportEntry, ParseWarning, RawItem } from '@/core/types';
import {
  FILE_SPECS,
  RELATIONSHIP_EXTENSIONS,
  relationshipFileBase,
  relationshipFormatOf,
} from './instagram-file-specs';
import {
  UNREADABLE_ENTRIES_FIX,
  describeUnreadableEntries,
  extractUsernames,
  resolveEntries,
  resolveEntryList,
} from './instagram-utils';
import { combineDatesFitted, parseRelationshipFile } from './instagram-html';
import { describeUnreadableZipEntry, type ZipArchive, type ZipEntry } from './zip-archive';

export interface FollowersParsed {
  followersRaw: RawItem[];
  followersUsers: string[];
  followersTimestamps: Map<string, number>;
  followersFound: boolean;
  foundFollowerPaths: string[];
  warnings: ParseWarning[];
  fileExpectation: FileExpectation;
  /**
   * True when the followers data was found but we could not read it (GH#21
   * Task 3). This is not "no followers"; it is followers we cannot see, and
   * `instagram.ts` uses it to keep the two out of the same exit.
   *
   * **Derived from the warnings**, not computed alongside them: it is exactly
   * "this file produced an error-severity warning". That is deliberate and
   * load-bearing. Both consumers of `hasMinimalData` take the FIRST
   * error-severity warning as the diagnostic code, and this task removed the
   * unconditional `createCriticalError` that used to guarantee one existed —
   * so `unreadable` without an error warning would be a silent dead end on the
   * most critical path. Defining one in terms of the other makes that state
   * unreachable instead of merely absent today.
   *
   * **An unrecognised shard counts even when a sibling shard parsed fine.**
   * Stricter than the entry-level half, and confirmed as intended: a partial
   * follower list is not a smaller right answer, it is a wrong one. Every
   * account in the missing shard is silently mislabelled `notFollowingBack` —
   * the exact failure class this plan exists to remove — and the reader has no
   * way to detect it. Showing thousands of readable followers beside a wrong
   * verdict is worse than failing loudly. The contrast with an unreadable
   * *record* is that the record is a loss we can count and report; a shard is a
   * loss of unknown size.
   */
  unreadable: boolean;
  /**
   * The shards' `datesFitted` facts (GH#156), combined with
   * `combineDatesFitted`: `undefined` when no shard had a date to fit,
   * `false` when any shard's own dates failed to fit, `true` otherwise.
   */
  datesFitted?: boolean;
}

/** Parse a single followers JSON text */
export async function parseFollowersJson(jsonText: string): Promise<string[]> {
  const data = JSON.parse(jsonText) as
    | InstagramExportEntry[]
    | { relationships_followers?: InstagramExportEntry[] };
  if (Array.isArray(data)) return extractUsernames(data);
  if (
    Array.isArray(
      (data as { relationships_followers?: InstagramExportEntry[] }).relationships_followers
    )
  )
    return extractUsernames(
      (data as { relationships_followers: InstagramExportEntry[] }).relationships_followers
    );
  throw new Error('Invalid followers json format');
}

/**
 * Turn the outcome of reading the shards into at most one warning.
 *
 * Extracted from `parseFollowersFromZip` rather than left inline: adding the
 * entry-level branch took that function to complexity 21 against a limit of 20.
 *
 * The wrapper and entry findings **accumulate** here, unlike in
 * `instagram-following.ts` where they are exclusive. That is not an
 * inconsistency, it is the multi-shard case: one shard with a renamed wrapper
 * and another whose records drifted is a single plausible Meta change, and only
 * followers can be in both states at once. Reporting the wrapper alone would
 * lose "the records also changed", which is the signal that separates a global
 * format drift from one mangled file — the diagnosis is the whole product of
 * this task, even where it does not change the decision.
 *
 * Worst first: both consumers of `hasMinimalData` report the FIRST error
 * warning, so the graver finding has to be at the front.
 */
function describeFollowersOutcome(outcome: {
  followersFound: boolean;
  formatInvalidFiles: string[];
  unresolvedEntries: number;
  resolvedCount: number;
}): ParseWarning[] {
  const { followersFound, formatInvalidFiles, unresolvedEntries, resolvedCount } = outcome;

  // Genuinely exclusive: with no shards at all, nothing below can be true.
  if (!followersFound) {
    return [
      {
        code: 'MISSING_FOLLOWERS',
        message: 'followers_*.json files not found — cannot detect who follows you.',
        severity: 'warning',
        fix: 'Make sure your Instagram export includes "Followers and following" data. Re-request if needed.',
      },
    ];
  }

  const warnings: ParseWarning[] = [];

  // Loud failure beats an undetectable wrong answer: at least one shard was
  // found but its shape wasn't recognized, so we can't be sure the followers
  // set is complete — and unlike an unreadable record, an unreadable shard is
  // a loss of unknown size.
  if (formatInvalidFiles.length > 0) {
    warnings.push({
      code: 'INVALID_FOLLOWERS_FORMAT',
      message: `followers data was found (${formatInvalidFiles.join(', ')}), but its structure is not recognized — cannot detect who follows you.`,
      severity: 'error',
      fix: 'Instagram may have changed their export format. Please report this issue so we can add support.',
    });
  }

  // The wrapper parsed and the records did not. Severity follows how much was
  // lost: nothing readable at all inverts the badge math for every follower and
  // has to reach DiagnosticErrorScreen, while losing some of them leaves the
  // answer incomplete rather than backwards, and blocking an otherwise good
  // upload over that is disproportionate.
  if (unresolvedEntries > 0) {
    warnings.push({
      code: 'UNRESOLVED_ENTRIES_FOLLOWERS',
      message: describeUnreadableEntries('followers_*.json', unresolvedEntries, resolvedCount),
      severity: resolvedCount === 0 ? 'error' : 'warning',
      fix: UNREADABLE_ENTRIES_FIX,
    });
  }

  // Only when nothing above fired: "empty" is a claim about a file we could
  // read, and saying it alongside a drift warning would contradict it.
  if (warnings.length === 0 && resolvedCount === 0) {
    warnings.push({
      code: 'EMPTY_FOLLOWERS',
      message: 'Followers files are empty or contain no valid accounts.',
      severity: 'info',
    });
  }

  return warnings;
}

/** Parse followers_*.json files from ZIP with dedup and multi-file merge */
export async function parseFollowersFromZip(
  archive: ZipArchive,
  baseCandidates: string[]
): Promise<FollowersParsed> {
  // Both extensions, because both are readable, and wider than any spec's
  // `fileNames` on purpose: an export sharded into `followers_4` and beyond is
  // read today and must keep being read, in either format.
  const followersGlobs = baseCandidates
    .map(b => `${b}/followers_.*\\.${RELATIONSHIP_EXTENSIONS}`)
    .concat([`followers_.*\\.${RELATIONSHIP_EXTENSIONS}`]);
  const followersRaw: RawItem[] = [];
  const followersSeen = new Set<string>();
  /**
   * One shard per base name, not per file name.
   *
   * `followers_1.json` and `followers_1.html` are the same shard written twice,
   * and both match the globs above — so a half-merged archive used to have its
   * followers read from BOTH and unioned. Harmless when the two are the same
   * export; a wrong answer when they are not, because the union of two
   * snapshots taken weeks apart contains people who have since unfollowed, and
   * every one of them then deflates `notFollowingBack` and inflates `mutuals`
   * with no warning attached.
   *
   * The rule is the one `readRelationshipFileFromZip` already applies to
   * `following.json`: at each base, JSON first, and read exactly one. Keeping
   * the two required files on different rules is what made this invisible —
   * `following` came from one export and `followers` from two.
   */
  const followersFilesByName = new Map<string, ZipEntry>();
  const warnings: ParseWarning[] = [];
  // Names of shards whose top-level shape didn't resolve via `resolveEntryList`
  // (GH#21) — neither a bare array, `{ relationships_followers: [...] }`, nor a
  // single bare entry object. A malformed shard is not silently dropped into
  // an empty result indistinguishable from having none.
  const formatInvalidFiles: string[] = [];
  // Summed across shards, not per shard: the reader has one followers list, so
  // "40 of your followers could not be read" is the fact, and which of three
  // files each came from is not something they can act on.
  let unresolvedEntries = 0;
  // One `datesFitted` per shard that actually got parsed (GH#156), combined
  // below with `combineDatesFitted` once every shard has been read.
  const shardDatesFitted: (boolean | undefined)[] = [];

  const keepShard = (f: ZipEntry) => {
    const base = relationshipFileBase(f.name);
    const kept = followersFilesByName.get(base);
    // First match wins, except that JSON outranks HTML however they were found.
    if (
      kept &&
      (relationshipFormatOf(f.name) !== 'json' || relationshipFormatOf(kept.name) === 'json')
    )
      return;
    followersFilesByName.set(base, f);
  };

  for (const g of followersGlobs) {
    const regex = new RegExp('^' + g + '$', 'i');
    for (const f of archive.find(regex)) keepShard(f);
  }

  if (followersFilesByName.size === 0) {
    const shardFallback = new RegExp(`followers_\\d+\\.${RELATIONSHIP_EXTENSIONS}$`, 'i');
    for (const f of archive.find(shardFallback)) keepShard(f);
  }

  // Reported after the choice, so what the reader is told was found is what was
  // actually read — a discarded twin is not a missing file and not a read one.
  const foundFollowerPaths = [...followersFilesByName.values()].map(f => f.name);

  for (const f of followersFilesByName.values()) {
    if (!f) continue;
    // Guarded, where the sibling call in instagram.ts:162 always was. The
    // asymmetry was invisible while JSZip threw read failures at open time; the
    // random-access reader raises them here, and an unguarded rejection escapes
    // parseInstagramZipFile entirely — past every warning, past the discovery
    // record, into the worker's catch, where classifyErrorMessage matches none
    // of zip.js's phrasings and answers UNKNOWN. The reader is told an
    // unexpected error occurred and pointed at the issue tracker.
    let text: string;
    try {
      text = await f.text();
    } catch (error) {
      // Error severity, so `unreadable` below picks it up: one bad shard
      // among good ones already marks the whole followers set unreadable
      // (see the rationale above this loop), and a shard we cannot open is
      // no better known than one whose shape we cannot recognise.
      warnings.push(describeUnreadableZipEntry(f.name, error, 'error'));
      continue;
    }
    let json: unknown;
    try {
      // By the entry's own extension, not by the archive's format: the first is
      // a fact about this file, the second an aggregate over the whole ZIP.
      const parsed = parseRelationshipFile(f.name, text);
      json = parsed.data;
      shardDatesFitted.push(parsed.datesFitted);
    } catch (error) {
      // Error severity, matching the read failure above: a shard we found but
      // could not parse — JSON.parse throwing, or the HTML transcoder throwing
      // on genuinely malformed markup — is exactly as unreadable as one we
      // could not open, and `unreadable` below must pick both up the same way
      // (GH#157).
      warnings.push({
        code: 'JSON_PARSE_ERROR',
        message: `Failed to parse ${f.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        severity: 'error',
      });
      continue;
    }
    const entries = resolveEntryList(json, ['relationships_followers']);

    if (entries === null) {
      formatInvalidFiles.push(f.name);
      continue;
    }

    const resolved = resolveEntries(entries);
    unresolvedEntries += resolved.unresolved;

    for (const it of resolved.items) {
      if (followersSeen.has(it.username)) continue;
      followersSeen.add(it.username);
      followersRaw.push(it);
    }
  }

  const followersUsers = followersRaw.map(r => r.username);
  const followersTimestamps = new Map(
    followersRaw.map(r => [r.username, r.timestamp ?? 0] as const)
  );

  const followersFound = followersFilesByName.size > 0;
  const followersSpec = FILE_SPECS[1]!;
  const fileExpectation: FileExpectation = {
    name: 'followers_*.json',
    description: followersSpec.description,
    required: true,
    found: followersFound,
    itemCount: followersUsers.length,
    foundPath: foundFollowerPaths[0],
    unreadableItemCount: unresolvedEntries,
    formatUnreadable: formatInvalidFiles.length > 0,
  };

  const outcome = describeFollowersOutcome({
    followersFound,
    formatInvalidFiles,
    unresolvedEntries,
    resolvedCount: followersUsers.length,
  });
  warnings.push(...outcome);

  // Derived from the warnings rather than recomputed alongside them, so the
  // two cannot disagree. See FollowersParsed.unreadable. Read from the full
  // `warnings` accumulated above, not only `outcome`: a shard whose read or
  // parse threw (GH#157) pushes its error-severity warning directly into
  // `warnings` before `describeFollowersOutcome` ever runs, and deriving from
  // `outcome` alone missed it — the shard vanished silently instead of marking
  // the followers set unreadable.
  const unreadable = warnings.some(w => w.severity === 'error');

  return {
    followersRaw,
    followersUsers,
    followersTimestamps,
    followersFound,
    foundFollowerPaths,
    warnings,
    fileExpectation,
    unreadable,
    datesFitted: combineDatesFitted(shardDatesFitted),
  };
}
