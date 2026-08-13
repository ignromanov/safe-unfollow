/**
 * Instagram Following Parser
 * Interprets following.json — top-level shape, records, and its diagnostics
 *
 * Sibling to `instagram-followers.ts`. Both required files now hand back the
 * same four things — their accounts, their warnings, their file expectation,
 * and whether their records were readable — so a caller cannot handle one and
 * forget the other. The returned fields are only those `instagram.ts` actually
 * reads; the followers module carries two more that nothing outside it uses,
 * and copying them for symmetry's sake would be surface with no reader.
 *
 * Until GH#21 Task 3 this half lived inline in `parseInstagramZipFile`, which
 * is why its entry-level failure went unnoticed while the followers half had a
 * home to grow in.
 */

import type { FileExpectation, ParseWarning, RawItem } from '@/core/types';
import { FILE_SPECS } from './instagram-file-specs';
import {
  UNREADABLE_ENTRIES_FIX,
  describeUnreadableEntries,
  resolveEntries,
  resolveEntryList,
} from './instagram-utils';

export interface FollowingParsed {
  followingUsers: string[];
  followingTimestamps: Map<string, number>;
  warnings: ParseWarning[];
  fileExpectation: FileExpectation;
  /**
   * True when the file was found and yielded no accounts because we could not
   * read it — either its wrapper matched no known shape, or every record in it
   * did (GH#21 Task 3). This is not "you follow nobody"; it is a following list
   * we cannot see, and `instagram.ts` uses it to keep the two out of the same
   * exit.
   *
   * One flag rather than two because the two failures produce the identical
   * wrong answer downstream — `following` ends up empty, so every follower is
   * badged notFollowedBack — and a caller that had to remember to check both
   * would eventually check one. Which failure it was stays visible in the
   * warning code and in `FileExpectation`; what is collapsed here is only the
   * decision, not the diagnosis.
   *
   * **Derived from the warnings**, not computed alongside them: it is exactly
   * "this file produced an error-severity warning". Both consumers of
   * `hasMinimalData` take the FIRST error-severity warning as the diagnostic
   * code, and this task removed the unconditional `createCriticalError` that
   * used to guarantee one existed — so `unreadable` without an error warning
   * would be a silent dead end on the most critical path. Defining one in terms
   * of the other makes that state unreachable rather than merely absent today.
   */
  unreadable: boolean;
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
 * has the scope seam).
 */
function interpretFollowingPayload(payload: unknown): {
  raw: RawItem[];
  formatInvalid: boolean;
  unresolved: number;
} {
  if (payload === undefined) return { raw: [], formatInvalid: false, unresolved: 0 };

  const entries = resolveEntryList(payload, ['relationships_following']);
  if (entries === null) return { raw: [], formatInvalid: true, unresolved: 0 };

  const resolved = resolveEntries(entries);
  return { raw: resolved.items, formatInvalid: false, unresolved: resolved.unresolved };
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
  const { raw, formatInvalid, unresolved } = interpretFollowingPayload(readResult?.data);
  const followingFound = readResult !== null;
  const followingUsers = raw.map(r => r.username);
  const nothingRead = followingUsers.length === 0;

  const fileExpectation: FileExpectation = {
    name: 'following.json',
    description: FILE_SPECS[0]!.description,
    required: true,
    found: followingFound,
    itemCount: followingUsers.length,
    foundPath: readResult?.path,
    unreadableItemCount: unresolved,
    formatUnreadable: followingFound && formatInvalid,
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
  } else if (unresolved > 0) {
    // Wrapper recognized, records not. Severity tracks how much was lost:
    // reading none of them empties `following` and flags every follower
    // notFollowedBack, so that has to reach DiagnosticErrorScreen; reading
    // some leaves the answer incomplete rather than inverted.
    warnings.push({
      code: 'UNRESOLVED_ENTRIES_FOLLOWING',
      message: describeUnreadableEntries('following.json', unresolved, followingUsers.length),
      severity: nothingRead ? 'error' : 'warning',
      fix: UNREADABLE_ENTRIES_FIX,
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
    // Derived, so it cannot disagree with what we told the reader. An absent
    // file yields MISSING_FOLLOWING at severity 'warning' and so is not
    // unreadable — "missing" and "present but unintelligible" stay apart.
    unreadable: warnings.some(w => w.severity === 'error'),
  };
}
