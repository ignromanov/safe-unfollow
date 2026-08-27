import type { DiagnosticErrorCode } from '@/core/types';

/**
 * Which guide section answers this failure, or null when none does.
 *
 * Was one hardcoded 6 for every code, threaded to five call sites: a reader
 * whose ZIP was not an Instagram export landed on the page about choosing JSON.
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
    // Four failures with one answer: request the export again, selecting only
    // "Followers and following". The first two because the file is not an
    // export at all; the second two because it is one, and too big to hold —
    // and their `fix` copy already says exactly that, in ten locales.
    case 'NOT_INSTAGRAM_EXPORT':
    case 'NOT_ZIP':
    case 'TOO_MANY_ENTRIES':
    case 'FILE_TOO_LARGE':
      return 3;
    case 'UNKNOWN':
      return null;
    default:
      return 5;
  }
}

/**
 * Deep link into the guide for a failure's recovery.
 *
 * `prefix` is the caller's locale prefix (from `useLanguagePrefix`), passed in
 * rather than read via a hook so this stays a pure function callable from
 * non-component code.
 *
 * ⚠️ `default: return 5` lives on borrowed time. `HTML_FORMAT` has no case of
 * its own — it rides the default, and when the parser accepts HTML it is not
 * one case that goes but the justification for the default arm itself.
 */
export function guideHrefForError(prefix: string, code?: DiagnosticErrorCode): string {
  const step = guideStepForError(code);
  return step === null ? `${prefix}/upload?guide=1` : `${prefix}/upload?step=${step}`;
}
