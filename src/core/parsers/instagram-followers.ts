/**
 * Instagram Followers Parser
 * Handles multi-file followers_*.json parsing with dedup
 */

import type JSZip from 'jszip';
import type { FileExpectation, InstagramExportEntry, ParseWarning, RawItem } from '@/core/types';
import { FILE_SPECS } from './instagram-file-specs';
import { extractUsernames, listToRaw } from './instagram-utils';

export interface FollowersParsed {
  followersRaw: RawItem[];
  followersUsers: string[];
  followersTimestamps: Map<string, number>;
  followersFound: boolean;
  foundFollowerPaths: string[];
  warnings: ParseWarning[];
  fileExpectation: FileExpectation;
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
  // Names of shards whose top-level shape matched neither a bare array nor
  // `{ relationships_followers: [...] }` (GH#21). A malformed shard is not
  // silently dropped into an empty result indistinguishable from having none.
  const formatInvalidFiles: string[] = [];

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
    const entries: unknown = Array.isArray(json)
      ? json
      : (json as Record<string, unknown> | null)?.relationships_followers;

    if (!Array.isArray(entries)) {
      formatInvalidFiles.push(f.name);
      continue;
    }

    const items = listToRaw(entries as InstagramExportEntry[]);
    for (const it of items) {
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
  };

  if (!followersFound) {
    warnings.push({
      code: 'MISSING_FOLLOWERS',
      message: 'followers_*.json files not found — cannot detect who follows you.',
      severity: 'warning',
      fix: 'Make sure your Instagram export includes "Followers and following" data. Re-request if needed.',
    });
  } else if (formatInvalidFiles.length > 0) {
    // Loud failure beats an undetectable wrong answer: at least one shard was
    // found but its shape wasn't recognized, so we can't be sure the
    // followers set is complete. Severity 'error' routes this to
    // DiagnosticErrorScreen (see UploadZone's hasCriticalError gate) even
    // though other shards may have parsed fine and left followersUsers
    // non-empty.
    warnings.push({
      code: 'INVALID_FOLLOWERS_FORMAT',
      message: `followers data was found (${formatInvalidFiles.join(', ')}), but its structure is not recognized — cannot detect who follows you.`,
      severity: 'error',
      fix: 'Instagram may have changed their export format. Please report this issue so we can add support.',
    });
  } else if (followersUsers.length === 0) {
    warnings.push({
      code: 'EMPTY_FOLLOWERS',
      message: 'Followers files are empty or contain no valid accounts.',
      severity: 'info',
    });
  }

  return {
    followersRaw,
    followersUsers,
    followersTimestamps,
    followersFound,
    foundFollowerPaths,
    warnings,
    fileExpectation,
  };
}
