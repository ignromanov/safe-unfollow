import type { DiagnosticErrorCode } from '@/core/types';

/**
 * Which wizard step answers this failure.
 *
 * Was one hardcoded 6 for every code, threaded to five call sites: a reader
 * whose ZIP was not an Instagram export landed on the page about choosing JSON.
 * Steps are numeric ids (config/wizard-steps.ts) and the URL is the source of
 * truth (useWizardNavigation.ts:14) — the destination varies, the routing does
 * not.
 */
export function wizardStepForError(code?: DiagnosticErrorCode): number {
  switch (code) {
    case 'NOT_INSTAGRAM_EXPORT':
    case 'NOT_ZIP':
      return 4;
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
