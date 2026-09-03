import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS } from '@/config/wizard-steps';
import { ALL_DIAGNOSTIC_ERROR_CODES, type DiagnosticErrorCode } from '@/core/types';
import { guideHrefForError, guideStepForError } from '@/lib/errors/wizard-routing';

/**
 * Where every diagnosed failure sends the reader, stated once.
 *
 * Written out rather than derived, because there is nothing to derive it from:
 * the step a failure answers is a judgement about the failure, not a property
 * of it. What IS derived is the key set: the guard below reads
 * `ALL_DIAGNOSTIC_ERROR_CODES`, so a code added to the union without a decision
 * here fails the suite instead of silently inheriting `default`. That
 * inheritance is how four codes whose own copy says "select Followers and
 * following" came to open the page about JSON.
 *
 * The `Record` annotation looks like it makes this exhaustive at compile time
 * and does not: tests are excluded from `tsconfig.json` (GH#70), so this file
 * is never type-checked. The check has to run.
 *
 * 4 = "Select Only Followers and following"  ·  6 = "Change Format to JSON"
 * null = open the guide at its start, claiming no step.
 */
const EXPECTED_STEP: Record<DiagnosticErrorCode, number | null> = {
  // Decided: re-request the export, ticking only "Followers and following".
  NOT_ZIP: 4,
  NOT_INSTAGRAM_EXPORT: 4,
  TOO_MANY_ENTRIES: 4,
  FILE_TOO_LARGE: 4,
  INCOMPLETE_EXPORT: 4,
  NO_DATA_FILES: 4,
  MISSING_FOLLOWING: 4,
  MISSING_FOLLOWERS: 4,

  // Decided: the export is readable but its format is the problem.
  HTML_FORMAT: 6,

  // Decided: a diagnosis that could not tell must not name a step.
  UNKNOWN: null,

  // Not decided — these inherit `default: 6`, which is the format step and
  // answers none of them. Recorded as it behaves today, not as it should:
  // sending a full disk or a crashed worker to "Change Format to JSON" is a
  // separate question from the one this file fixes, and it belongs to whoever
  // rules on the default arm.
  INVALID_FOLLOWING_FORMAT: 6,
  INVALID_FOLLOWERS_FORMAT: 6,
  CORRUPTED_ZIP: 6,
  ZIP_ENCRYPTED: 6,
  EMPTY_FILE: 6,
  JSON_PARSE_ERROR: 6,
  INVALID_DATA_STRUCTURE: 6,
  WORKER_TIMEOUT: 6,
  WORKER_INIT_ERROR: 6,
  WORKER_CRASHED: 6,
  INDEXEDDB_ERROR: 6,
  QUOTA_EXCEEDED: 6,
  IDB_NOT_SUPPORTED: 6,
  IDB_PERMISSION_DENIED: 6,
  UPLOAD_CANCELLED: 6,
  CRYPTO_NOT_AVAILABLE: 6,
  NETWORK_ERROR: 6,
};

describe('guideStepForError', () => {
  it.each(['NOT_INSTAGRAM_EXPORT', 'NOT_ZIP', 'TOO_MANY_ENTRIES', 'FILE_TOO_LARGE'] as const)(
    '%s points at "only Followers and following"',
    code => {
      // Old step 4, then 3, now 4 again. The first two because the file is not an export at
      // all; the second two because it is one and too big to hold — and their
      // `fix` copy already says exactly that, in ten locales.
      expect(guideStepForError(code)).toBe(4);
    }
  );

  it.each([
    'INCOMPLETE_EXPORT',
    'NO_DATA_FILES',
    'MISSING_FOLLOWING',
    'MISSING_FOLLOWERS',
  ] as const)('%s points at "only Followers and following"', code => {
    // The diagnosis is that the follower lists are absent, and the `fix` copy
    // for all four says so in ten locales: "ensure Followers and following is
    // selected". They had no case of their own, so they rode the default to
    // the format step — the reader was told to tick a checkbox and sent to the
    // page about JSON.
    expect(guideStepForError(code)).toBe(4);
  });

  it('UNKNOWN claims no step at all', () => {
    // A diagnosis that concluded it could not tell what went wrong must not
    // claim the precision of a step number.
    expect(guideStepForError('UNKNOWN')).toBeNull();
  });

  it('falls back to the format step when nothing was diagnosed', () => {
    expect(guideStepForError(undefined)).toBe(6);
  });

  it('sends HTML_FORMAT to the format step', () => {
    // No case of its own: it rides the default, and the default exists for it.
    // When the parser accepts HTML both disappear together.
    expect(guideStepForError('HTML_FORMAT')).toBe(6);
  });

  it('routes every diagnostic code where the table says, and no code is unclassified', () => {
    // The guard, not a restatement of the table above. The key set is built
    // from the production union, so this one assertion fails two ways: a code
    // added to the union but not classified here shows up as an extra key, and
    // routing that drifts from a decision shows up as a changed value.
    const actual = Object.fromEntries(
      ALL_DIAGNOSTIC_ERROR_CODES.map(code => [code, guideStepForError(code)])
    );

    expect(actual).toEqual(EXPECTED_STEP);
  });

  it.each([undefined, ...ALL_DIAGNOSTIC_ERROR_CODES])(
    'never routes %s past the end of GUIDE_STEPS',
    code => {
      // The table above pins WHERE each code goes; this pins that the
      // destination exists. The literals there (4, 6) are hand-written and
      // GUIDE_STEPS' length is not: PR-1 renumbered eight sections to seven,
      // 6fdc9a1 moved these with it, and restoring "Open Accounts Center" as
      // step 1 moved them back — three renumberings, none of which anything
      // tied to the list, so the next one would leave this file pointing past
      // the end.
      // It fails softly, which is why it needs a test — `?step` out of range
      // does not error, it just opens the guide at no particular section, so the
      // reader whose upload failed silently loses the one answer we routed them
      // to. This branch is why it matters now: the /wizard routes that used to
      // serve the same sections are gone, so this is the only addressing left.
      //
      // The subjects are the production union, not the seven codes this test
      // was first written with. A bound check that covers only the codes
      // someone remembered is the defect the assertion above just closed,
      // wearing the fix's clothes.
      const step = guideStepForError(code);
      if (step === null) return;

      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(GUIDE_STEPS.length);
    }
  );
});

describe('guideHrefForError', () => {
  it('deep-links into the guide on the upload page', () => {
    expect(guideHrefForError('/id', 'NOT_ZIP')).toBe('/id/upload?step=4');
  });

  it('opens the guide from the start when there is no step', () => {
    expect(guideHrefForError('', 'UNKNOWN')).toBe('/upload?guide=1');
  });
});
