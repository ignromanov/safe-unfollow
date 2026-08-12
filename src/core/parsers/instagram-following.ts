/**
 * Instagram Following Parser
 * Interprets following.json — top-level shape, records, and its diagnostics
 *
 * Sibling to `instagram-followers.ts`. Both required files hand back their
 * accounts, their warnings and their file expectation, so a caller cannot
 * handle one and forget the other. The returned fields are only those
 * `instagram.ts` actually reads; the followers module carries two more that
 * nothing outside it uses, and copying them for symmetry's sake would be
 * surface with no reader.
 *
 * This half used to live inline in `parseInstagramZipFile` while the followers
 * half had a module of its own — the asymmetry is why a gap in one was easy to
 * notice and the same gap in the other was not.
 */

import type { FileExpectation, ParseWarning, RawItem } from '@/core/types';
import { FILE_SPECS } from './instagram-file-specs';
import { resolveEntries, resolveEntryList } from './instagram-utils';

export interface FollowingParsed {
  followingUsers: string[];
  followingTimestamps: Map<string, number>;
  warnings: ParseWarning[];
  fileExpectation: FileExpectation;
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

/**
 * Read following.json's already-loaded payload into accounts and diagnostics.
 *
 * Takes the read result rather than the ZIP, unlike its followers counterpart:
 * following.json is a single named file whose lookup shares
 * `parseInstagramZipFile`'s `readJsonFromZip` closure — that closure also
 * records JSON_PARSE_ERROR warnings, and duplicating it here would duplicate
 * that reporting too.
 */
export function parseFollowingPayload(
  readResult: { data: unknown; path: string } | null
): FollowingParsed {
  const { raw, formatInvalid } = interpretFollowingPayload(readResult?.data);
  const followingFound = readResult !== null;
  const followingUsers = raw.map(r => r.username);

  const fileExpectation: FileExpectation = {
    name: 'following.json',
    description: FILE_SPECS[0]!.description,
    required: true,
    found: followingFound,
    itemCount: followingUsers.length,
    foundPath: readResult?.path,
  };

  const warnings: ParseWarning[] = [];
  if (!followingFound) {
    warnings.push({
      code: 'MISSING_FOLLOWING',
      message: 'following.json not found — cannot detect who you follow.',
      severity: 'warning',
      fix: 'Make sure your Instagram export includes "Followers and following" data. Re-request if needed.',
    });
  } else if (formatInvalid) {
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

  return {
    followingUsers,
    followingTimestamps: new Map(raw.map(r => [r.username, r.timestamp ?? 0] as const)),
    warnings,
    fileExpectation,
  };
}
