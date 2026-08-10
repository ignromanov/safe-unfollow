/**
 * Instagram Optional File Parser
 * Handles parsing of optional relationship files (pending, restricted, close friends, etc.)
 */

import type { FileExpectation, InstagramExportEntry, ParseWarning } from '@/core/types';
import { FILE_SPECS, PERMANENT_REQUESTS_SPEC, type FileSpec } from './instagram-file-specs';
import { listToMap } from './instagram-utils';

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

/** Read and parse a single optional file using flexible property lookup */
async function readListMapFlexible(
  spec: FileSpec,
  readFirstExistingJson: (fileNames: string[]) => Promise<{ data: unknown; path: string } | null>
): Promise<OptionalFileResult> {
  const result = await readFirstExistingJson(spec.fileNames);
  if (!result) return { map: new Map(), found: false, count: 0, formatValid: true };

  const entries = Array.isArray(result.data)
    ? result.data
    : (spec.propCandidates
        ?.map(p => (result.data as Record<string, unknown>)?.[p])
        .find(e => Array.isArray(e)) as InstagramExportEntry[] | undefined);

  if (!Array.isArray(entries)) {
    // Found but neither shape matched: a genuinely empty array ([]) takes the
    // branch above and never reaches here, so this is specifically "shape not
    // recognized", not "empty file" — see instagram-format-drift.ts fixtures.
    return { map: new Map(), found: true, path: result.path, count: 0, formatValid: false };
  }

  const map = listToMap(entries);
  return { map, found: true, path: result.path, count: map.size, formatValid: true };
}

/** Parse all optional relationship files from ZIP */
export async function parseOptionalFiles(
  baseCandidates: string[],
  readJsonFromZip: ReadJsonFromZip
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
  const optionalResults = await Promise.all(
    optionalSpecs.map(spec => readListMapFlexible(spec, readFirstExistingJson))
  );

  const emptyResult: OptionalFileResult = {
    map: new Map<string, number>(),
    found: false,
    count: 0,
    formatValid: true,
  };
  const pendingResult = optionalResults[0] ?? emptyResult;
  const restrictedResult = optionalResults[1] ?? emptyResult;
  const closeFriendsResult = optionalResults[2] ?? emptyResult;
  const unfollowedResult = optionalResults[3] ?? emptyResult;
  const dismissedResult = optionalResults[4] ?? emptyResult;

  // Parse permanent follow requests (separate spec for historical reasons)
  const permanentResult = await readListMapFlexible(PERMANENT_REQUESTS_SPEC, readFirstExistingJson);

  // Build file expectations and format-drift warnings for optional files.
  //
  // Severity 'warning', not 'error': optional-file drift zeroes one badge
  // without inverting the core following/followers math, so failing the
  // whole upload is disproportionate (GH#21). Each spec carries its own
  // driftCode (instagram-file-specs.ts) so a consumer can tell which file
  // drifted without parsing the message text.
  const fileExpectations: FileExpectation[] = [];
  const warnings: ParseWarning[] = [];
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
    if (result.found && !result.formatValid && spec.driftCode) {
      warnings.push({
        code: spec.driftCode,
        message: `${spec.name} was found, but its structure is not recognized — Instagram may have changed this file's format.`,
        severity: 'warning',
      });
    }
  }

  if (permanentResult.found && !permanentResult.formatValid && PERMANENT_REQUESTS_SPEC.driftCode) {
    warnings.push({
      code: PERMANENT_REQUESTS_SPEC.driftCode,
      message: `${PERMANENT_REQUESTS_SPEC.name} was found, but its structure is not recognized — Instagram may have changed this file's format.`,
      severity: 'warning',
    });
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
