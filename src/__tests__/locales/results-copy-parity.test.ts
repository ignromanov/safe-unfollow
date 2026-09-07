import { describe, expect, it } from 'vitest';
import resultsEN from '@/locales/en/results.json';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * Neither list is written by hand. i18next falls back to the key string rather
 * than to English, so a key present in `en` and missing in one locale ships a
 * raw dotted path on a live page — and a test that enumerates the keys it
 * checks stops covering the next key somebody adds.
 */
const keyPaths = (obj: unknown, prefix = ''): string[] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keyPaths(v, `${prefix}${k}.`)
  );

describe('results copy parity', () => {
  const english = keyPaths(resultsEN).sort();

  it('should have found the English keys at all', () => {
    expect(english.length).toBeGreaterThan(20); // the instrument fired
  });

  it.each(SUPPORTED_LANGUAGES)('should carry every English key in %s', async code => {
    const bundle = (await import(`../../locales/${code}/results.json`)).default;

    expect(keyPaths(bundle).sort()).toEqual(english);
  });
});
