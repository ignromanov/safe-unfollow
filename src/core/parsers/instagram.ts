import type {
  FileDiscovery,
  FileExpectation,
  ParsedAll,
  ParseResult,
  ParseWarning,
} from '@/core/types';
import { BASE_PATH_CANDIDATES, FILE_SPECS, RELEVANT_FILE_PATTERN } from './instagram-file-specs';
import { escapeRegExp, extractUsernames } from './instagram-utils';
import { analyzeZipStructure, createCriticalError } from './instagram-zip-analysis';
import { parseFollowersFromZip } from './instagram-followers';
import { parseFollowingPayload } from './instagram-following';
import { parseOptionalFiles } from './instagram-optional';
import { createEmptyParsedAll } from './instagram-validation';
import {
  classifyZipFailure,
  describeUnreadableZipEntry,
  openZipArchive,
  type ZipArchive,
} from './zip-archive';

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

// Zip-bomb protection. 200k, not 10k: an "All of your information" export
// from a decade-old account carries tens of thousands of media files, one
// entry each, and the old limit told those exports they were fake. It was
// unreachable while the 500MB ceiling fired first, and deleting the ceiling
// routed them straight into it.
//
// The number is a sanity bound on our own walk of the central directory, not
// a statement about what a real export looks like — so the message says so.
//
// Above 65,535 entries a non-ZIP64 archive reports its count modulo 65,536,
// and this reader trusts that field (zip-reader.js:276), so such an archive is
// read short. Compliant writers do not produce one, no mitigation is free —
// zip.js's checkAmbiguity rejects the truncation but also rejects benign
// quirks in valid archives — and the failure is loud rather than silent. The
// signal to watch instead is upload_error_not_instagram arriving at multi-GB
// file_size_mb, which the failure event now carries.
//
// Passed to openZipArchive as its retention bound too, so the walk holds at
// most what an accepted archive needs. One number, because two that must agree
// eventually will not.
const MAX_ZIP_ENTRIES = 200_000;

// === Main Parser ===

export async function parseInstagramZipFile(file: File): Promise<ParseResult> {
  // Try to load ZIP with error handling for corrupted files
  let archive: ZipArchive;
  try {
    archive = await openZipArchive(file, RELEVANT_FILE_PATTERN, MAX_ZIP_ENTRIES);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const code = classifyZipFailure(err);
    const message =
      code === 'ZIP_ENCRYPTED' ? 'ZIP file is password-protected' : 'Failed to read ZIP file';

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
      // No optional file was ever read — nothing to resolve a label from, and
      // nothing to overstate (GH#41).
      labelResolutionMode: 'not-applicable',
      followRequestsUnreadable: false,
    };
  }

  const allFiles = archive.names;

  if (archive.count > MAX_ZIP_ENTRIES) {
    return {
      data: createEmptyParsedAll(),
      warnings: [
        {
          code: 'TOO_MANY_ENTRIES',
          message: `This ZIP contains ${archive.count.toLocaleString()} files, more than this tool can index (${MAX_ZIP_ENTRIES.toLocaleString()}).`,
          severity: 'error',
          fix: 'Ask Instagram for a smaller export: Meta Accounts Center → Create export → select only "Followers and following" → format JSON.',
        },
      ],
      discovery: { format: 'unknown', isInstagramExport: false, files: [] },
      hasMinimalData: false,
      labelResolutionMode: 'not-applicable',
      followRequestsUnreadable: false,
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
      labelResolutionMode: 'not-applicable',
      followRequestsUnreadable: false,
    };
  }

  const baseCandidates = BASE_PATH_CANDIDATES;

  // Set when a *required* file was found in the index and then could not be
  // read. Not the same failure as a file that is absent, and the two must not
  // share an exit — the whole of GH#21 is that distinction.
  //
  // It needs saying here because the backend swap moved a class of errors onto
  // this path. JSZip's loadAsync walked every local file header, so encryption,
  // an unsupported compression method and a damaged local header all threw
  // while the archive was being opened, inside the guarded call at the top of
  // this function. zip.js reads the central directory alone, so those same
  // conditions now throw when the entry is read — here, where the old code
  // caught them, called them JSON_PARSE_ERROR at severity 'warning', and
  // returned the same null it returns for "no such file". The reader was then
  // shown a successful analysis over an empty `following` set, with every
  // follower badged notFollowedBack and no error anywhere.
  let unreadableRequiredPath: string | undefined;

  const readJsonFromZip = async (
    patterns: string[],
    required = false
  ): Promise<{ data: unknown; path: string } | null> => {
    for (const p of patterns) {
      const f = archive.find(new RegExp('^' + escapeRegExp(p) + '$', 'i'))[0];
      if (!f) continue;

      let text: string;
      try {
        text = await f.text();
      } catch (error) {
        if (required) unreadableRequiredPath = f.name;
        // An optional file we cannot read costs a badge, not the answer, and
        // severity 'error' would take over the whole screen for it.
        warnings.push(describeUnreadableZipEntry(f.name, error, required ? 'error' : 'warning'));
        return null;
      }

      try {
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
    return null;
  };

  // === Parse Following ===
  const followingFilePatterns = baseCandidates
    .map(b => `${b}/following.json`)
    .concat(['following.json']);
  const followingParsed = parseFollowingPayload(
    await readJsonFromZip(followingFilePatterns, true),
    unreadableRequiredPath
  );
  const followingUsers = followingParsed.followingUsers;
  warnings.push(...followingParsed.warnings);
  fileExpectations.push(followingParsed.fileExpectation);

  // === Parse Followers (delegated) ===
  const followersParsed = await parseFollowersFromZip(archive, baseCandidates);
  warnings.push(...followersParsed.warnings);
  fileExpectations.push(followersParsed.fileExpectation);

  // === Parse Optional Files (delegated) ===
  // Membership breaks localised-username-label ties (GH#21, instagram-labels).
  // Passed unbuilt: these are the two files that reach 1M accounts, the tiebreak
  // is the resolver's last resort, and no measured archive gets that far.
  const readKnownUsernames = (): ReadonlySet<string> => {
    const known = new Set(followingUsers);
    for (const username of followersParsed.followersUsers) known.add(username);
    return known;
  };
  const optionalParsed = await parseOptionalFiles(
    baseCandidates,
    readJsonFromZip,
    readKnownUsernames
  );
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
    labelResolutionMode: optionalParsed.labelResolutionMode,
    followRequestsUnreadable: optionalParsed.followRequestsUnreadable,
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
