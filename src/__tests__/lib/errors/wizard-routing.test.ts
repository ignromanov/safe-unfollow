import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS } from '@/config/wizard-steps';
import { guideHrefForError, guideStepForError } from '@/lib/errors/wizard-routing';

describe('guideStepForError', () => {
  it.each(['NOT_INSTAGRAM_EXPORT', 'NOT_ZIP', 'TOO_MANY_ENTRIES', 'FILE_TOO_LARGE'] as const)(
    '%s points at "only Followers and following"',
    code => {
      // Old step 4, now 3. The first two because the file is not an export at
      // all; the second two because it is one and too big to hold — and their
      // `fix` copy already says exactly that, in ten locales.
      expect(guideStepForError(code)).toBe(3);
    }
  );

  it('UNKNOWN claims no step at all', () => {
    // A diagnosis that concluded it could not tell what went wrong must not
    // claim the precision of a step number.
    expect(guideStepForError('UNKNOWN')).toBeNull();
  });

  it('falls back to the format step when nothing was diagnosed', () => {
    expect(guideStepForError(undefined)).toBe(5);
  });

  it('sends HTML_FORMAT to the format step', () => {
    // No case of its own: it rides the default, and the default exists for it.
    // When the parser accepts HTML both disappear together.
    expect(guideStepForError('HTML_FORMAT')).toBe(5);
  });
  it.each([
    undefined,
    'NOT_INSTAGRAM_EXPORT',
    'NOT_ZIP',
    'TOO_MANY_ENTRIES',
    'FILE_TOO_LARGE',
    'HTML_FORMAT',
    'UNKNOWN',
  ] as const)('never routes %s past the end of GUIDE_STEPS', code => {
    // The literals above (3, 5) are hand-written and GUIDE_STEPS' length is
    // not: PR-1 renumbered eight sections to seven and 6fdc9a1 moved these
    // with it, but nothing tied the two together, so the next deletion of a
    // section would leave this file pointing past the end. It fails softly,
    // which is why it needs a test — `?step` out of range does not error, it
    // just opens the guide at no particular section, so the reader whose
    // upload failed silently loses the one answer we routed them to. This
    // branch is why it matters now: the /wizard routes that used to serve the
    // same sections are gone, so this is the only addressing left.
    const step = guideStepForError(code);
    if (step === null) return;

    expect(step).toBeGreaterThanOrEqual(1);
    expect(step).toBeLessThanOrEqual(GUIDE_STEPS.length);
  });
});

describe('guideHrefForError', () => {
  it('deep-links into the guide on the upload page', () => {
    expect(guideHrefForError('/id', 'NOT_ZIP')).toBe('/id/upload?step=3');
  });

  it('opens the guide from the start when there is no step', () => {
    expect(guideHrefForError('', 'UNKNOWN')).toBe('/upload?guide=1');
  });
});
