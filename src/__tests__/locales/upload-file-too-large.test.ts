import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/upload.json', {
  eager: true,
  import: 'default',
});

function copyFor(language: string): { title: string; message: string; fix: string } {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no upload.json for ${language}`);
  return (entry[1] as any).diagnostic.errors.FILE_TOO_LARGE;
}

/**
 * The advice this copy replaced — "use a desktop browser with more memory" —
 * was false in all ten languages for as long as it shipped: the ceiling was a
 * constant, so a machine with 64GB was rejected at 501MB exactly like a phone.
 * Nothing caught it, because nothing read the localised strings. This does.
 */
describe('FILE_TOO_LARGE copy', () => {
  it('is present and non-empty in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const copy = copyFor(language);
      expect(copy.title, `${language} title`).toBeTruthy();
      expect(copy.message, `${language} message`).toBeTruthy();
      expect(copy.fix, `${language} fix`).toBeTruthy();
    }
  });

  it('never blames the device or its memory', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(copyFor(language).fix, language).not.toMatch(
        /desktop|memory|Speicher|mémoire|memori|memoria|память|ذاكرة|メモリ|bellek/i
      );
    }
  });

  it('quotes no ceiling — there is none left to quote', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const copy = copyFor(language);
      expect(`${copy.message} ${copy.fix}`, language).not.toMatch(/500/);
    }
  });

  it('interpolates nothing', () => {
    // The only caller that ever supplied {{sizeMb}} was the size guard, deleted
    // with the ceiling. DiagnosticErrorScreen renders these with a defaultValue
    // and no variables, so a surviving placeholder would reach the reader.
    for (const language of SUPPORTED_LANGUAGES) {
      const copy = copyFor(language);
      expect(`${copy.title} ${copy.message} ${copy.fix}`, language).not.toMatch(/\{\{/);
    }
  });
});
