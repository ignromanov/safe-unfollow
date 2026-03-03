import JSZip from 'jszip';
import type {
  FileDiscovery,
  FileExpectation,
  InstagramExportEntry,
  ParsedAll,
  ParseResult,
  ParseWarning,
  RawItem,
} from '@/core/types';
import {
  BASE_PATH_CANDIDATES,
  FILE_SPECS,
  PERMANENT_REQUESTS_SPEC,
  type FileSpec,
} from './instagram-file-specs';
import { escapeRegExp, extractUsernames, listToMap, listToRaw } from './instagram-utils';
import { analyzeZipStructure, createCriticalError } from './instagram-zip-analysis';

/**
 * Parse following.json file
 */
export async function parseFollowingJson(jsonText: string): Promise<string[]> {
  const data = JSON.parse(jsonText) as
    | { relationships_following?: InstagramExportEntry[] }
    | InstagramExportEntry[];
  if (Array.isArray(data)) {
    return extractUsernames(data);
  }
  if (!data.relationships_following)
    throw new Error('Invalid following.json: missing relationships_following');
  return extractUsernames(data.relationships_following);
}

/**
 * Parse followers_*.json file
 */
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

// === Main Parser ===

// eslint-disable-next-line complexity -- Parser naturally has high complexity due to multiple file format checks and error paths
export async function parseInstagramZipFile(file: File): Promise<ParseResult> {
  // Try to load ZIP with error handling for corrupted files
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    let code = 'CORRUPTED_ZIP';
    let message = 'Failed to read ZIP file';

    if (errorMessage.toLowerCase().includes('encrypted')) {
      code = 'ZIP_ENCRYPTED';
      message = 'ZIP file is password-protected';
    }

    return {
      data: createEmptyParsedAll(),
      warnings: [
        {
          code,
          message: `${message}: ${errorMessage}`,
          severity: 'error',
          fix: 'Try re-downloading your data from Instagram Settings.',
        },
      ],
      discovery: { format: 'unknown', isInstagramExport: false, files: [] },
      hasMinimalData: false,
    };
  }

  const allFiles = Object.keys(zip.files ?? {});

  // Zip bomb protection: limit entry count
  const MAX_ZIP_ENTRIES = 10_000;
  if (allFiles.length > MAX_ZIP_ENTRIES) {
    return {
      data: createEmptyParsedAll(),
      warnings: [
        {
          code: 'CORRUPTED_ZIP',
          message: `ZIP contains ${allFiles.length.toLocaleString()} entries (limit: ${MAX_ZIP_ENTRIES.toLocaleString()}). This does not look like a valid Instagram export.`,
          severity: 'error',
          fix: 'Make sure you are uploading the correct ZIP file from Instagram. A normal export typically contains fewer than 1,000 files.',
        },
      ],
      discovery: { format: 'unknown', isInstagramExport: false, files: [] },
      hasMinimalData: false,
    };
  }

  const analysis = analyzeZipStructure(allFiles);

  const warnings: ParseWarning[] = [];
  const fileExpectations: FileExpectation[] = [];

  // Determine format
  const format: FileDiscovery['format'] = analysis.hasJsonFiles
    ? 'json'
    : analysis.hasHtmlFiles
      ? 'html'
      : 'unknown';

  // Check if this is an Instagram export
  const isInstagramExport = analysis.hasConnections || analysis.hasFollowersFolder;

  // If not a valid Instagram export, return early with error
  if (!isInstagramExport || format === 'html') {
    const error = createCriticalError(analysis);
    warnings.push(error);

    // Create empty expectations for all files
    for (const spec of FILE_SPECS) {
      fileExpectations.push({
        name: spec.name,
        description: spec.description,
        required: spec.required,
        found: false,
      });
    }

    return {
      data: createEmptyParsedAll(),
      warnings,
      discovery: {
        format,
        isInstagramExport,
        basePath: analysis.basePath,
        files: fileExpectations,
      },
      hasMinimalData: false,
    };
  }

  // Try common paths
  const baseCandidates = BASE_PATH_CANDIDATES;

  const readJsonFromZip = async (
    patterns: string[]
  ): Promise<{ data: unknown; path: string } | null> => {
    for (const p of patterns) {
      const f = zip.file(new RegExp('^' + escapeRegExp(p) + '$', 'i'))[0];
      if (f) {
        try {
          const text = await f.async('text');
          return { data: JSON.parse(text), path: f.name };
        } catch (error) {
          warnings.push({
            code: 'JSON_PARSE_ERROR',
            message: `Failed to parse ${f.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
            severity: 'warning',
          });
          return null;
        }
      }
    }
    return null;
  };

  // === Parse Following ===
  const followingFilePatterns = baseCandidates
    .map(b => `${b}/following.json`)
    .concat(['following.json']);
  const followingResult = await readJsonFromZip(followingFilePatterns);
  let followingRaw: RawItem[] = [];
  let followingFound = false;
  let followingPath: string | undefined;

  if (followingResult) {
    followingFound = true;
    followingPath = followingResult.path;
    const entries = Array.isArray(followingResult.data)
      ? followingResult.data
      : (followingResult.data as { relationships_following?: RawItem[] })?.relationships_following;
    followingRaw = listToRaw(entries);
  }

  const followingUsers = followingRaw.map(r => r.username);
  const followingTimestamps = new Map(
    followingRaw.map(r => [r.username, r.timestamp ?? 0] as const)
  );

  const followingSpec = FILE_SPECS[0]!;
  fileExpectations.push({
    name: 'following.json',
    description: followingSpec.description,
    required: true,
    found: followingFound,
    itemCount: followingUsers.length,
    foundPath: followingPath,
  });

  if (!followingFound) {
    warnings.push({
      code: 'MISSING_FOLLOWING',
      message: 'following.json not found — cannot detect who you follow.',
      severity: 'warning',
      fix: 'Make sure your Instagram export includes "Followers and following" data. Re-request if needed.',
    });
  } else if (followingUsers.length === 0) {
    warnings.push({
      code: 'EMPTY_FOLLOWING',
      message: 'following.json is empty or contains no valid accounts.',
      severity: 'info',
    });
  }

  // === Parse Followers ===
  const followersGlobs = baseCandidates
    .map(b => `${b}/followers_.*\\.json`)
    .concat(['followers_.*\\.json']);
  const followersRaw: RawItem[] = [];
  const followersSeen = new Set<string>();
  const followersFilesByName = new Map<string, JSZip.JSZipObject>();
  const foundFollowerPaths: string[] = [];

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
    const entries = Array.isArray(json)
      ? json
      : (json as { relationships_followers?: InstagramExportEntry[] })?.relationships_followers;
    const items = listToRaw(entries);
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
  fileExpectations.push({
    name: 'followers_*.json',
    description: followersSpec.description,
    required: true,
    found: followersFound,
    itemCount: followersUsers.length,
    foundPath: foundFollowerPaths[0],
  });

  if (!followersFound) {
    warnings.push({
      code: 'MISSING_FOLLOWERS',
      message: 'followers_*.json files not found — cannot detect who follows you.',
      severity: 'warning',
      fix: 'Make sure your Instagram export includes "Followers and following" data. Re-request if needed.',
    });
  } else if (followersUsers.length === 0) {
    warnings.push({
      code: 'EMPTY_FOLLOWERS',
      message: 'Followers files are empty or contain no valid accounts.',
      severity: 'info',
    });
  }

  // === Parse Optional Files ===
  const readFirstExistingJsonFromZip = async (
    fileNames: string[]
  ): Promise<{ data: unknown; path: string } | null> => {
    for (const name of fileNames) {
      const result = await readJsonFromZip(baseCandidates.map(b => `${b}/${name}`).concat([name]));
      if (result) return result;
    }
    return null;
  };

  const readListMapFlexible = async (
    spec: FileSpec
  ): Promise<{ map: Map<string, number>; found: boolean; path?: string; count: number }> => {
    const result = await readFirstExistingJsonFromZip(spec.fileNames);
    if (!result) return { map: new Map(), found: false, count: 0 };

    const entries = Array.isArray(result.data)
      ? result.data
      : (spec.propCandidates
          ?.map(p => (result.data as Record<string, unknown>)?.[p])
          .find(e => Array.isArray(e)) as InstagramExportEntry[] | undefined);

    const map = listToMap(entries);
    return { map, found: true, path: result.path, count: map.size };
  };

  // Parse all optional files
  const optionalSpecs = FILE_SPECS.slice(2); // Skip following and followers
  const optionalResults = await Promise.all(optionalSpecs.map(spec => readListMapFlexible(spec)));

  // Default result for missing optional files
  const emptyResult = { map: new Map<string, number>(), found: false, count: 0 };
  const pendingResult = optionalResults[0] ?? emptyResult;
  const restrictedResult = optionalResults[1] ?? emptyResult;
  const closeFriendsResult = optionalResults[2] ?? emptyResult;
  const unfollowedResult = optionalResults[3] ?? emptyResult;
  const dismissedResult = optionalResults[4] ?? emptyResult;

  // Parse permanent follow requests (separate spec for historical reasons)
  const permanentResult = await readListMapFlexible(PERMANENT_REQUESTS_SPEC);

  // Add optional file expectations
  for (let i = 0; i < optionalSpecs.length; i++) {
    const spec = optionalSpecs[i]!;
    const result = optionalResults[i]!;
    fileExpectations.push({
      name: spec.name,
      description: spec.description,
      required: false,
      found: result.found,
      itemCount: result.count,
      foundPath: result.path,
    });
  }

  // Determine if we have minimal data
  const hasMinimalData = followingUsers.length > 0 || followersUsers.length > 0;

  if (!hasMinimalData) {
    warnings.push(createCriticalError(analysis));
  }

  // Create discovery object
  const discovery: FileDiscovery = {
    format,
    isInstagramExport: true,
    basePath: analysis.basePath,
    files: fileExpectations,
  };

  return {
    data: {
      following: new Set(followingUsers),
      followers: new Set(followersUsers),
      pendingSent: pendingResult.map,
      permanentRequests: permanentResult.map,
      restricted: restrictedResult.map,
      closeFriends: closeFriendsResult.map,
      unfollowed: unfollowedResult.map,
      dismissedSuggestions: dismissedResult.map,
      followingTimestamps,
      followersTimestamps,
    },
    warnings,
    discovery,
    hasMinimalData,
  };
}

function createEmptyParsedAll(): ParsedAll {
  return {
    following: new Set(),
    followers: new Set(),
    pendingSent: new Map(),
    permanentRequests: new Map(),
    restricted: new Map(),
    closeFriends: new Map(),
    unfollowed: new Map(),
    dismissedSuggestions: new Map(),
    followingTimestamps: new Map(),
    followersTimestamps: new Map(),
  };
}

// === Legacy Support ===
// Keep the old function signature for backward compatibility

/**
 * @deprecated Use parseInstagramZipFile which returns ParseResult
 */
export async function parseInstagramZipFileThrows(file: File): Promise<ParsedAll> {
  const result = await parseInstagramZipFile(file);

  if (!result.hasMinimalData) {
    const error = result.warnings.find(w => w.severity === 'error');
    throw new Error(error?.message ?? 'Could not parse Instagram data');
  }

  return result.data;
}
