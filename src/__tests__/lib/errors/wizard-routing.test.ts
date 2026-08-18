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
});

describe('wizardHrefForError', () => {
  it('prefixes the mapped step with the given locale prefix', () => {
    expect(wizardHrefForError('/es', 'NOT_INSTAGRAM_EXPORT')).toBe('/es/wizard/step/4');
  });

  it('works with an empty prefix', () => {
    expect(wizardHrefForError('', 'HTML_FORMAT')).toBe('/wizard/step/6');
  });
});
