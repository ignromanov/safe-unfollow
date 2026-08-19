import { describe, expect, it } from 'vitest';
import { wizardHrefForError, wizardStepForError } from '@/lib/errors/wizard-routing';

describe('wizardStepForError', () => {
  it('sends a format failure to the step that sets the format', () => {
    expect(wizardStepForError('HTML_FORMAT')).toBe(6);
  });

  it('sends a not-an-export failure to the step that requests the export', () => {
    expect(wizardStepForError('NOT_INSTAGRAM_EXPORT')).toBe(4);
  });

  it('falls back to the format step when there is no code', () => {
    expect(wizardStepForError(undefined)).toBe(6);
  });

  it('sends an undiagnosed failure to the guide start, not the format step', () => {
    expect(wizardStepForError('UNKNOWN')).toBe(1);
  });
});

describe('wizardHrefForError', () => {
  it('prefixes the mapped step with the given locale prefix', () => {
    expect(wizardHrefForError('/es', 'NOT_INSTAGRAM_EXPORT')).toBe('/es/wizard/step/4');
  });

  it('works with an empty prefix', () => {
    expect(wizardHrefForError('', 'HTML_FORMAT')).toBe('/wizard/step/6');
  });
});

describe('the two size failures point where their own copy points', () => {
  // Both codes' `fix` text, in all ten locales, tells the reader to ask
  // Instagram for a smaller export by selecting only "Followers and
  // following". That is wizard step 4. Falling through to the default sent
  // them to step 6, "Change format to JSON" — so the button under the
  // paragraph contradicted the paragraph. This file exists to remove exactly
  // that class of mismatch (see its docblock); the two codes were simply added
  // to the union and not to the switch.
  it.each(['TOO_MANY_ENTRIES', 'FILE_TOO_LARGE'] as const)(
    '%s routes to the step that selects only Followers and following',
    code => {
      expect(wizardStepForError(code)).toBe(4);
    }
  );
});
