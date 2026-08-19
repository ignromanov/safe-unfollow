import type { DiagnosticErrorCode } from '@/core/types';

/**
 * Which wizard step answers this failure.
 *
 * Was one hardcoded 6 for every code, threaded to five call sites: a reader
 * whose ZIP was not an Instagram export landed on the page about choosing JSON.
 * Steps are numeric ids (config/wizard-steps.ts) and the URL is the source of
 * truth (useWizardNavigation.ts:14) — the destination varies, the routing does
 * not.
 *
 * `undefined` and `'UNKNOWN'` are not the same input. `undefined` means no code
 * was ever produced (a caller that never diagnosed the failure) and keeps the
 * long-standing fallback to the format step. `'UNKNOWN'` means a diagnosis ran
 * and concluded it could not tell what went wrong — sending that to the format
 * step claims a certainty the diagnosis explicitly does not have, so it goes to
 * the guide's start instead.
 */
export function wizardStepForError(code?: DiagnosticErrorCode): number {
  switch (code) {
    // Four failures with one answer: request the export again, selecting only
    // "Followers and following". The first two because the file is not an
    // export at all; the second two because it is one, and too big to hold —
    // and their `fix` copy already says exactly that, in ten locales. Left to
    // the default those two pointed at the format step, so the button
    // contradicted the paragraph directly above it.
    case 'NOT_INSTAGRAM_EXPORT':
    case 'NOT_ZIP':
    case 'TOO_MANY_ENTRIES':
    case 'FILE_TOO_LARGE':
      return 4;
    case 'UNKNOWN':
      return 1;
    default:
      return 6;
  }
}

/**
 * Full wizard step URL for a failure's recovery deep link.
 *
 * `prefix` is the caller's locale prefix (from `useLanguagePrefix`), passed in
 * rather than read via a hook so this stays a pure function callable from
 * non-component code.
 */
export function wizardHrefForError(prefix: string, code?: DiagnosticErrorCode): string {
  return `${prefix}/wizard/step/${wizardStepForError(code)}`;
}
