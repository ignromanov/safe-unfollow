import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

type Dates = Record<string, string> | undefined;

const loadDates = async (lang: string): Promise<Dates> =>
  (await import(`../../locales/${lang}/results.json`)).default.dates;

const LINE_KEYS = ['following', 'followers', 'mutual', 'requested'] as const;

describe('follow-date copy', () => {
  it.each(SUPPORTED_LANGUAGES)(
    '%s carries the four line keys with {{date}} exactly once',
    async lang => {
      const dates = await loadDates(lang);
      for (const k of LINE_KEYS) {
        const s = dates?.[k];
        expect(typeof s, `${lang} dates.${k}`).toBe('string');
        expect((s as string).split('{{date}}').length - 1, `${lang} dates.${k}`).toBe(1);
      }
    }
  );

  it.each(SUPPORTED_LANGUAGES)('%s carries a stale hint with no placeholder', async lang => {
    const hint = (await loadDates(lang))?.staleHint;
    expect(hint).toMatch(/\S/);
    expect(hint).not.toContain('{{');
  });

  it('en is the ruled copy, verbatim', async () => {
    expect(await loadDates('en')).toEqual({
      following: 'Following since {{date}}',
      followers: 'Follows you since {{date}}',
      mutual: 'Mutual since {{date}}',
      requested: 'Request sent {{date}}',
      staleHint: 'Upload your Instagram ZIP again to see follow dates. The same file works.',
    });
  });
});
