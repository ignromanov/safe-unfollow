import JSZip from 'jszip';
import type {
  FileDiscovery,
  FileExpectation,
  ParsedAll,
  ParseResult,
  ParseWarning,
} from '@/core/types';
import { BASE_PATH_CANDIDATES, FILE_SPECS } from './instagram-file-specs';
import { escapeRegExp, extractUsernames } from './instagram-utils';
import { analyzeZipStructure, createCriticalError } from './instagram-zip-analysis';
import { parseFollowersFromZip } from './instagram-followers';
import { parseFollowingPayload } from './instagram-following';
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
  const followingParsed = parseFollowingPayload(await readJsonFromZip(followingFilePatterns));
  const followingUsers = followingParsed.followingUsers;
  warnings.push(...followingParsed.warnings);
  fileExpectations.push(followingParsed.fileExpectation);

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

  // A required file that was found and could not be read is not "no data" — it
  // is data we cannot read, and the two must not share an exit (GH#21).
  // Widening the OR below would have said "we found nothing"; gating it says
  // "we found it and failed", which is the true and actionable one.
  //
  // "Could not read it" covers both halves, and each file reports them as one
  // flag: the wrapper matched no known shape, or the wrapper was fine and every
  // record inside it drifted. They are one condition because they produce one
  // outcome — the set comes back empty, so every follower is badged
  // notFollowedBack — and that outcome is the worst in GH#21 whichever half
  // caused it. Splitting them here would mean a caller could gate one and
  // forget the other, which is exactly how the entry half shipped without the
  // wrapper half. Which one it was is not lost: it stays in the warning code
  // and in `FileExpectation`. Only the decision is shared, not the diagnosis.
  //
  // An absent file is not unreadable and must not reach this — "missing" and
  // "present but unintelligible" are different answers and keeping them apart
  // is the point of the whole task.
  //
  // Both callers of hasMinimalData take the first error warning as the code, so
  // the critical error is withheld to leave ours first.
  const requiredFileUnreadable = followingParsed.unreadable || followersParsed.unreadable;
  const hasMinimalData =
    !requiredFileUnreadable &&
    (followingUsers.length > 0 || followersParsed.followersUsers.length > 0);

  if (!hasMinimalData && !requiredFileUnreadable) {
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
      followingTimestamps: followingParsed.followingTimestamps,
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
