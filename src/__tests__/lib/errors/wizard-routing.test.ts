import { describe, expect, it } from 'vitest';
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
});

describe('guideHrefForError', () => {
  it('deep-links into the guide on the upload page', () => {
    expect(guideHrefForError('/id', 'NOT_ZIP')).toBe('/id/upload?step=3');
  });

  it('opens the guide from the start when there is no step', () => {
    expect(guideHrefForError('', 'UNKNOWN')).toBe('/upload?guide=1');
  });
});
