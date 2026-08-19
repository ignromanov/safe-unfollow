import { describe, expect, it } from 'vitest';
import { getColorScheme, isRecoverable } from '@/lib/errors/diagnostic-utils';

describe('getColorScheme', () => {
  it('paints a recoverable failure amber even though its severity is error', () => {
    const colors = getColorScheme({ code: 'HTML_FORMAT', severity: 'error' });

    expect(colors.icon).toContain('amber');
  });

  it('keeps a fatal failure rose — nothing the reader can do to this file', () => {
    const colors = getColorScheme({ code: 'NOT_INSTAGRAM_EXPORT', severity: 'error' });

    expect(colors.icon).toContain('rose');
  });

  it('still honours severity: warning for codes outside the set', () => {
    const colors = getColorScheme({ code: 'MISSING_FOLLOWERS', severity: 'warning' });

    expect(colors.icon).toContain('amber');
  });
});

describe('isRecoverable', () => {
  it('is true for a code the reader can fix themselves', () => {
    expect(isRecoverable('HTML_FORMAT')).toBe(true);
  });

  it('is false for a code outside the recoverable set', () => {
    expect(isRecoverable('NOT_INSTAGRAM_EXPORT')).toBe(false);
  });
});
