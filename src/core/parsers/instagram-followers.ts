/**
 * Instagram Followers Parser
 * Handles multi-file followers_*.json parsing with dedup
 */

import type JSZip from 'jszip';
import type { FileExpectation, InstagramExportEntry, ParseWarning, RawItem } from '@/core/types';
import { FILE_SPECS } from './instagram-file-specs';
import {
  UNREADABLE_ENTRIES_FIX,
  describeUnreadableEntries,
  extractUsernames,
  resolveEntries,
  resolveEntryList,
} from './instagram-utils';

export interface FollowersParsed {
  followersRaw: RawItem[];
  followersUsers: string[];
  followersTimestamps: Map<string, number>;
  followersFound: boolean;
  foundFollowerPaths: string[];
  warnings: ParseWarning[];
  fileExpectation: FileExpectation;
  /**
   * True when the followers data was found but we could not read it — any shard
   * whose wrapper matched no known shape, or shards that yielded no accounts at
   * all because every record in them was unreadable (GH#21 Task 3). This is not
   * "no followers"; it is followers we cannot see.
   *
   * An unrecognised shard counts even when a sibling shard parsed fine, which
   * is stricter than the entry-level half. The asymmetry is deliberate: an
   * unreadable record is a loss we can count and report, while an unreadable
   * shard is a loss of unknown size — it could be most of the list — and the
   * followers set silently missing an unknown fraction is what makes
   * notFollowedBack wrong without appearing to be.
   */
  unreadable: boolean;
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
 * The branches are ordered worst-first and are mutually exclusive by intent —
 * a reader who has been told the shards are missing does not also need to be
 * told they are empty.
 */
function describeFollowersOutcome(outcome: {
  followersFound: boolean;
  formatInvalidFiles: string[];
  unresolvedEntries: number;
  resolvedCount: number;
}): ParseWarning[] {
  const { followersFound, formatInvalidFiles, unresolvedEntries, resolvedCount } = outcome;

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

  // Loud failure beats an undetectable wrong answer: at least one shard was
  // found but its shape wasn't recognized, so we can't be sure the followers
  // set is complete — and unlike an unreadable record, an unreadable shard is
  // a loss of unknown size.
  if (formatInvalidFiles.length > 0) {
    return [
      {
        code: 'INVALID_FOLLOWERS_FORMAT',
        message: `followers data was found (${formatInvalidFiles.join(', ')}), but its structure is not recognized — cannot detect who follows you.`,
        severity: 'error',
        fix: 'Instagram may have changed their export format. Please report this issue so we can add support.',
      },
    ];
  }

  // The wrapper parsed and the records did not. Severity follows how much was
  // lost: nothing readable at all inverts the badge math for every follower and
  // has to reach DiagnosticErrorScreen, while losing some of them leaves the
  // answer incomplete rather than backwards, and blocking an otherwise good
  // upload over that is disproportionate.
  if (unresolvedEntries > 0) {
    return [
      {
        code: 'UNRESOLVED_ENTRIES_FOLLOWERS',
        message: describeUnreadableEntries('followers_*.json', unresolvedEntries, resolvedCount),
        severity: resolvedCount === 0 ? 'error' : 'warning',
        fix: UNREADABLE_ENTRIES_FIX,
      },
    ];
  }

  if (resolvedCount === 0) {
    return [
      {
        code: 'EMPTY_FOLLOWERS',
        message: 'Followers files are empty or contain no valid accounts.',
        severity: 'info',
      },
    ];
  }

  return [];
}

/** Parse followers_*.json files from ZIP with dedup and multi-file merge */
export async function parseFollowersFromZip(
  zip: JSZip,
  baseCandidates: string[]
): Promise<FollowersParsed> {
  const followersGlobs = baseCandidates
    .map(b => `${b}/followers_.*\\.json`)
    .concat(['followers_.*\\.json']);
  const followersRaw: RawItem[] = [];
  const followersSeen = new Set<string>();
  const followersFilesByName = new Map<string, JSZip.JSZipObject>();
  const foundFollowerPaths: string[] = [];
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

  for (const g of followersGlobs) {
    const regex = new RegExp('^' + g + '$', 'i');
    for (const f of zip.file(regex)) {
      if (!followersFilesByName.has(f.name)) {
        followersFilesByName.set(f.name, f);
        foundFollowerPaths.push(f.name);
      }
    }
  }

  if (followersFilesByName.size === 0) {
    for (const f of zip.file(/followers_\d+\.json$/i)) {
      if (!followersFilesByName.has(f.name)) {
        followersFilesByName.set(f.name, f);
        foundFollowerPaths.push(f.name);
      }
    }
  }

  for (const f of followersFilesByName.values()) {
    if (!f) continue;
    const text = await f.async('text');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      warnings.push({
        code: 'JSON_PARSE_ERROR',
        message: `Failed to parse ${f.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        severity: 'warning',
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
  const nothingRead = followersUsers.length === 0;
  const unreadable = formatInvalidFiles.length > 0 || (nothingRead && unresolvedEntries > 0);
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

  warnings.push(
    ...describeFollowersOutcome({
      followersFound,
      formatInvalidFiles,
      unresolvedEntries,
      resolvedCount: followersUsers.length,
    })
  );

  return {
    followersRaw,
    followersUsers,
    followersTimestamps,
    followersFound,
    foundFollowerPaths,
    warnings,
    fileExpectation,
    unreadable,
  };
}
