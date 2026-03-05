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
  if (!result) return { map: new Map(), found: false, count: 0 };

  const entries = Array.isArray(result.data)
    ? result.data
    : (spec.propCandidates
        ?.map(p => (result.data as Record<string, unknown>)?.[p])
        .find(e => Array.isArray(e)) as InstagramExportEntry[] | undefined);

  const map = listToMap(entries);
  return { map, found: true, path: result.path, count: map.size };
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
  };
  const pendingResult = optionalResults[0] ?? emptyResult;
  const restrictedResult = optionalResults[1] ?? emptyResult;
  const closeFriendsResult = optionalResults[2] ?? emptyResult;
  const unfollowedResult = optionalResults[3] ?? emptyResult;
  const dismissedResult = optionalResults[4] ?? emptyResult;

  // Parse permanent follow requests (separate spec for historical reasons)
  const permanentResult = await readListMapFlexible(PERMANENT_REQUESTS_SPEC, readFirstExistingJson);

  // Build file expectations for optional files
  const fileExpectations: FileExpectation[] = [];
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

  return {
    pendingResult,
    permanentResult,
    restrictedResult,
    closeFriendsResult,
    unfollowedResult,
    dismissedResult,
    fileExpectations,
    warnings: [],
  };
}
