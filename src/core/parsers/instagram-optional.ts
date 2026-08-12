/**
 * Instagram Optional File Parser
 * Handles parsing of optional relationship files (pending, restricted, close friends, etc.)
 */

import type { FileExpectation, ParseWarning } from '@/core/types';
import { FILE_SPECS, PERMANENT_REQUESTS_SPEC, type FileSpec } from './instagram-file-specs';
import { resolveUsernameLabel } from './instagram-labels';
import {
  UNREADABLE_ENTRIES_FIX,
  describeUnreadableEntries,
  resolveEntries,
  resolveEntryList,
} from './instagram-utils';

export interface OptionalFileResult {
  map: Map<string, number>;
  found: boolean;
  path?: string;
  count: number;
  /**
   * False when the file was found but its top-level shape matched neither a
   * bare array nor any propCandidate holding one (GH#21). Defaults to true
   * when the file is absent — there's no shape to judge — and when a
   * recognized shape happens to be genuinely empty.
   */
  formatValid: boolean;
  /**
   * Entries whose shape was recognized at the file level but whose username
   * could not be read (GH#21 Task 1). `count: 0` on its own cannot tell a
   * genuinely empty file from one whose every record drifted — this is the
   * number that can, and the entry-level diagnostics build on it.
   */
  unresolvedEntries: number;
}

export interface OptionalFilesParsed {
  pendingResult: OptionalFileResult;
  permanentResult: OptionalFileResult;
  restrictedResult: OptionalFileResult;
  closeFriendsResult: OptionalFileResult;
  unfollowedResult: OptionalFileResult;
  dismissedResult: OptionalFileResult;
  fileExpectations: FileExpectation[];
  warnings: ParseWarning[];
}

type ReadJsonFromZip = (patterns: string[]) => Promise<{ data: unknown; path: string } | null>;

/**
 * One optional file after reading and top-level shape resolution, but before
 * its entries are read.
 *
 * Reading and mapping are separate passes because the username label is
 * resolved from the whole archive at once, not per file — see
 * `instagram-labels.ts`. Pooling is **defensive**, not a fix for a known
 * failure: measured per file, all six optional files in both August archives
 * resolve standalone, single-record ones included. It protects the case a
 * small file cannot survive — a display name that is itself username-shaped,
 * leaving one record scoring 1/1 against 1/1 with nothing to separate them.
 */
interface ReadOptionalFile {
  found: boolean;
  path?: string;
  /** `null` means the top-level shape was not recognized. */
  entries: unknown[] | null;
}

/** Read a single optional file and resolve its top level, nothing more. */
async function readOptionalFile(
  spec: FileSpec,
  readFirstExistingJson: (fileNames: string[]) => Promise<{ data: unknown; path: string } | null>
): Promise<ReadOptionalFile> {
  const result = await readFirstExistingJson(spec.fileNames);
  if (!result) return { found: false, entries: null };

  // A genuinely empty array resolves to `[]`; only an unrecognized shape
  // resolves to `null` — see instagram-format-drift.ts fixtures.
  return {
    found: true,
    path: result.path,
    entries: resolveEntryList(result.data, spec.propCandidates),
  };
}

/** Map one already-read file's entries using the archive-wide username label. */
function toOptionalFileResult(
  file: ReadOptionalFile,
  usernameLabel: string | null
): OptionalFileResult {
  if (!file.found) {
    return { map: new Map(), found: false, count: 0, formatValid: true, unresolvedEntries: 0 };
  }

  if (file.entries === null) {
    return {
      map: new Map(),
      found: true,
      path: file.path,
      count: 0,
      formatValid: false,
      unresolvedEntries: 0,
    };
  }

  const resolved = resolveEntries(file.entries, usernameLabel);
  const map = new Map(resolved.items.map(item => [item.username, item.timestamp ?? 0] as const));

  return {
    map,
    found: true,
    path: file.path,
    count: map.size,
    formatValid: true,
    unresolvedEntries: resolved.unresolved,
  };
}

/**
 * Parse all optional relationship files from ZIP.
 *
 * `knownUsernames` is `following ∪ followers`, already normalised. It feeds
 * only the membership tiebreak that identifies a localised username label when
 * value shape cannot (see `instagram-labels.ts`). It defaults to empty, which
 * leaves the tiebreak inert rather than crashing or guessing — the right
 * behaviour when `following.json` is missing or its own shape drifted.
 */
export async function parseOptionalFiles(
  baseCandidates: string[],
  readJsonFromZip: ReadJsonFromZip,
  knownUsernames: ReadonlySet<string> = new Set()
): Promise<OptionalFilesParsed> {
  const readFirstExistingJson = async (
    fileNames: string[]
  ): Promise<{ data: unknown; path: string } | null> => {
    for (const name of fileNames) {
      const result = await readJsonFromZip(baseCandidates.map(b => `${b}/${name}`).concat([name]));
      if (result) return result;
    }
    return null;
  };

  const optionalSpecs = FILE_SPECS.slice(2); // Skip following and followers
  // Permanent-requests is a separate spec for historical reasons, but carries
  // the same entries and must contribute to the same label pool. `readFiles`
  // is index-aligned to this array below, and the tiebreak filter depends on
  // that alignment.
  const specs = [...optionalSpecs, PERMANENT_REQUESTS_SPEC];

  // Pass 1: read every optional file and resolve its top-level shape.
  const readFiles = await Promise.all(
    specs.map(spec => readOptionalFile(spec, readFirstExistingJson))
  );

  // Resolve the username label once, over every entry in the archive. Doing it
  // per file would leave the single-record files unreadable, and doing it
  // seven times would be seven chances to disagree.
  //
  // `custom_lists.json` also carries label_values and would pollute this pool
  // with a different label set. It stays out as a consequence of not being in
  // FILE_SPECS, not because anything filters it — adding it to the specs for
  // some unrelated reason would silently drag it in here too.
  const usernameLabel = resolveUsernameLabel(
    readFiles.flatMap(file => file.entries ?? []),
    {
      tiebreakEntries: readFiles.flatMap((file, index) =>
        specs[index]?.impliesKnownAccount === true ? (file.entries ?? []) : []
      ),
      knownUsernames,
    }
  );

  // Pass 2: map each file's entries with that label.
  const optionalResults = readFiles.map(file => toOptionalFileResult(file, usernameLabel));

  const emptyResult: OptionalFileResult = {
    map: new Map<string, number>(),
    found: false,
    count: 0,
    formatValid: true,
    unresolvedEntries: 0,
  };
  const pendingResult = optionalResults[0] ?? emptyResult;
  const restrictedResult = optionalResults[1] ?? emptyResult;
  const closeFriendsResult = optionalResults[2] ?? emptyResult;
  const unfollowedResult = optionalResults[3] ?? emptyResult;
  const dismissedResult = optionalResults[4] ?? emptyResult;
  const permanentResult = optionalResults[optionalSpecs.length] ?? emptyResult;

  // Build file expectations and drift warnings for optional files.
  //
  // Severity 'warning', not 'error': optional-file drift zeroes one badge
  // without inverting the core following/followers math, so failing the
  // whole upload is disproportionate (GH#21). Each spec carries its own
  // driftCode and entryDriftCode (instagram-file-specs.ts) so a consumer can
  // tell which file drifted, and how, without parsing the message text.
  //
  // `specs` rather than `optionalSpecs`: permanent-requests was parsed and
  // warned about but never appended to fileExpectations, so nothing downstream
  // could report on one of the two files feeding notFollowingBack. Walking the
  // same array the read pass walked is what keeps a seventh file from
  // inheriting that hole.
  const fileExpectations: FileExpectation[] = [];
  const warnings: ParseWarning[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const result = optionalResults[i]!;
    fileExpectations.push({
      name: spec.name,
      description: spec.description,
      required: false,
      found: result.found,
      itemCount: result.count,
      foundPath: result.path,
      unreadableItemCount: result.unresolvedEntries,
      formatUnreadable: result.found && !result.formatValid,
    });
    if (result.found && !result.formatValid && spec.driftCode) {
      warnings.push({
        code: spec.driftCode,
        message: `${spec.name} was found, but its structure is not recognized — Instagram may have changed this file's format.`,
        severity: 'warning',
      });
    }
    // Deliberately not an `else`: the two are exclusive today only because an
    // unrecognized top level yields no entries to count. Keeping them
    // independent means the day that stops being true, both fire.
    if (result.unresolvedEntries > 0 && spec.entryDriftCode) {
      warnings.push({
        code: spec.entryDriftCode,
        message: describeUnreadableEntries(spec.name, result.unresolvedEntries, result.count),
        severity: 'warning',
        fix: UNREADABLE_ENTRIES_FIX,
      });
    }
  }

  return {
    pendingResult,
    permanentResult,
    restrictedResult,
    closeFriendsResult,
    unfollowedResult,
    dismissedResult,
    fileExpectations,
    warnings,
  };
}
