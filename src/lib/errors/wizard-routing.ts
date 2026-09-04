import { guideStepId } from '@/config/wizard-steps';
import type { DiagnosticErrorCode } from '@/core/types';

/**
 * Which guide section answers this failure, or null when none does.
 *
 * Was one hardcoded 6 for every code, threaded to five call sites: a reader
 * whose ZIP was not an Instagram export landed on the page about choosing JSON.
 *
 * The two sections below are named, not numbered. They used to be the literals
 * 4 and 6, which followed `GUIDE_STEPS` only by whoever edited the list
 * remembering to edit this file too — and the numbering has moved three times.
 * A bare ordinal cannot go wrong loudly: insert one instruction anywhere above
 * and `return 4` still passes every gate, including the length bound in
 * `wizard-routing.test.ts`, while pointing at whatever slid into slot 4.
 *
 * `undefined` and `'UNKNOWN'` are not the same input. `undefined` means no code
 * was ever produced (a caller that never diagnosed the failure) and keeps the
 * long-standing fallback to the format step. `'UNKNOWN'` means a diagnosis ran
 * and concluded it could not tell what went wrong — sending that to a numbered
 * section claims a certainty the diagnosis explicitly does not have, so it
 * opens the guide from the start instead.
 */
export function guideStepForError(code?: DiagnosticErrorCode): number | null {
  switch (code) {
    // Eight failures with one answer: request the export again, selecting only
    // "Followers and following". The first two because the file is not an
    // export at all; the next two because it is one, and too big to hold; the
    // last four because it is one and the follower lists are not in it — and
    // every one of their `fix` strings already says exactly that, in ten
    // locales.
    case 'NOT_INSTAGRAM_EXPORT':
    case 'NOT_ZIP':
    case 'TOO_MANY_ENTRIES':
    case 'FILE_TOO_LARGE':
    case 'INCOMPLETE_EXPORT':
    case 'NO_DATA_FILES':
    case 'MISSING_FOLLOWING':
    case 'MISSING_FOLLOWERS':
      return guideStepId('selectFollowers');
    case 'UNKNOWN':
      return null;
    default:
      return guideStepId('formatJson');
  }
}

/**
 * Deep link into the guide for a failure's recovery.
 *
 * `prefix` is the caller's locale prefix (from `useLanguagePrefix`), passed in
 * rather than read via a hook so this stays a pure function callable from
 * non-component code.
 *
 * ⚠️ The `formatJson` default lives on borrowed time. `HTML_FORMAT` has no case
 * of its own — it rides the default, and when the parser accepts HTML it is not
 * one case that goes but the justification for the default arm itself.
 */
export function guideHrefForError(prefix: string, code?: DiagnosticErrorCode): string {
  const step = guideStepForError(code);
  return step === null ? `${prefix}/upload?guide=1` : `${prefix}/upload?step=${step}`;
}
