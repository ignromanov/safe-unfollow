import JSZip from 'jszip';
import type {
  FileDiscovery,
  FileExpectation,
  ParsedAll,
  ParseResult,
  ParseWarning,
  RawItem,
} from '@/core/types';
import { BASE_PATH_CANDIDATES, FILE_SPECS } from './instagram-file-specs';
import {
  escapeRegExp,
  extractUsernames,
  resolveEntries,
  resolveEntryList,
} from './instagram-utils';
import { analyzeZipStructure, createCriticalError } from './instagram-zip-analysis';
import { parseFollowersFromZip } from './instagram-followers';
import { parseOptionalFiles } from './instagram-optional';
import { createEmptyParsedAll } from './instagram-validation';

// Re-export for backward compatibility
export { parseFollowersJson } from './instagram-followers';

/**
 * Parse following.json file
 */
export async function parseFollowingJson(jsonText: string): Promise<string[]> {
  const data = JSON.parse(jsonText) as
    | { relationships_following?: import('@/core/types').InstagramExportEntry[] }
    | import('@/core/types').InstagramExportEntry[];
  if (Array.isArray(data)) {
    return extractUsernames(data);
  }
  if (!data.relationships_following)
    throw new Error('Invalid following.json: missing relationships_following');
  return extractUsernames(data.relationships_following);
}

/**
 * Interpret the top level of following.json.
 *
 * Shape resolution is delegated to `resolveEntryList` (GH#21): a bare array,
 * the `relationships_following` wrapper, or a single bare entry object. This
 * file hasn't been observed to drift into the last shape but shared the same
 * latent gap. `formatInvalid` is true only when none match; a genuinely empty
 * array is recognised and leaves it false — the entire point, since
 * `resolveEntries` yields no items either way and an unrecognised shape must
 * not be allowed to look like an empty file. No username label is passed:
 * following.json still uses `title`/`string_list_data` (`instagram-labels.ts`
 * has the scope seam). Extracted rather than inlined because the shape check
 * pushed `parseInstagramZipFile` past the complexity ceiling.
 */
function interpretFollowingPayload(payload: unknown): {
  raw: RawItem[];
  formatInvalid: boolean;
} {
  if (payload === undefined) return { raw: [], formatInvalid: false };

  const entries = resolveEntryList(payload, ['relationships_following']);

  return entries !== null
    ? { raw: resolveEntries(entries).items, formatInvalid: false }
    : { raw: [], formatInvalid: true };
}

// === Main Parser ===

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
  const { raw: followingRaw, formatInvalid: followingFormatInvalid } = interpretFollowingPayload(
    followingResult?.data
  );
  const followingFound = followingResult !== null;
  const followingPath = followingResult?.path;

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
  } else if (followingFormatInvalid) {
    // Loud failure beats an undetectable wrong answer: no known shape matched,
    // so following stays an empty Set and — unflagged — would make badge math
    // (notFollowedBack) confidently wrong for every follower. Severity 'error'
    // routes this to DiagnosticErrorScreen (UploadZone's hasCriticalError).
    warnings.push({
      code: 'INVALID_FOLLOWING_FORMAT',
      message:
        'following.json was found, but its structure is not recognized — cannot detect who you follow.',
      severity: 'error',
      fix: 'Instagram may have changed their export format. Please report this issue so we can add support.',
    });
  } else if (followingUsers.length === 0) {
    warnings.push({
      code: 'EMPTY_FOLLOWING',
      message: 'following.json is empty or contains no valid accounts.',
      severity: 'info',
    });
  }

  // === Parse Followers (delegated) ===
  const followersParsed = await parseFollowersFromZip(zip, baseCandidates);
  warnings.push(...followersParsed.warnings);
  fileExpectations.push(followersParsed.fileExpectation);

  // === Parse Optional Files (delegated) ===
  // Membership breaks localised-username-label ties (GH#21, instagram-labels).
  const knownUsernames = new Set([...followingUsers, ...followersParsed.followersUsers]);
  const optionalParsed = await parseOptionalFiles(baseCandidates, readJsonFromZip, knownUsernames);
  warnings.push(...optionalParsed.warnings);
  fileExpectations.push(...optionalParsed.fileExpectations);

  // Determine if we have minimal data
  const hasMinimalData = followingUsers.length > 0 || followersParsed.followersUsers.length > 0;

  if (!hasMinimalData) {
    warnings.push(createCriticalError(analysis));
  }

  const discovery: FileDiscovery = {
    format,
    isInstagramExport: true,
    basePath: analysis.basePath,
    files: fileExpectations,
  };

  return {
    data: {
      following: new Set(followingUsers),
      followers: new Set(followersParsed.followersUsers),
      pendingSent: optionalParsed.pendingResult.map,
      permanentRequests: optionalParsed.permanentResult.map,
      restricted: optionalParsed.restrictedResult.map,
      closeFriends: optionalParsed.closeFriendsResult.map,
      unfollowed: optionalParsed.unfollowedResult.map,
      dismissedSuggestions: optionalParsed.dismissedResult.map,
      followingTimestamps,
      followersTimestamps: followersParsed.followersTimestamps,
    },
    warnings,
    discovery,
    hasMinimalData,
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
