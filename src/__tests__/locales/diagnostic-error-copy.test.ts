import { describe, expect, it } from 'vitest';

import { ALL_DIAGNOSTIC_ERROR_CODES } from '@/core/types/errors';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/upload.json', {
  eager: true,
  import: 'default',
});

function errorsFor(language: string): Record<string, { title: string; message: string; fix: string }> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no upload.json for ${language}`);
  return (entry[1] as any).diagnostic.errors;
}

/**
 * Two codes have no localised copy in any language, English included, and fall
 * back to the hard-coded strings in `errors.ts` — which is why the screen never
 * looks broken and nothing ever noticed. They are exempted rather than fixed
 * here: they belong to GH#21 and their wording is not this change's to decide.
 * Delete an entry from this list the day its ten translations land.
 */
const NO_LOCALISED_COPY = ['INVALID_FOLLOWING_FORMAT', 'INVALID_FOLLOWERS_FORMAT'];

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
describe('diagnostic error copy', () => {
  it('exists in every language for every code, so none falls back to English', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const errors = errorsFor(language);
      for (const code of ALL_DIAGNOSTIC_ERROR_CODES) {
        if (NO_LOCALISED_COPY.includes(code)) continue;
        const copy = errors[code];
        expect(copy, `${language}/${code}`).toBeDefined();
        expect(copy.title, `${language}/${code} title`).toBeTruthy();
        expect(copy.message, `${language}/${code} message`).toBeTruthy();
        expect(copy.fix, `${language}/${code} fix`).toBeTruthy();
      }
    }
  });

  it('leaves the exemption list accurate — a fixed code must leave it', () => {
    // The list is a record of a gap, not a permission. If one of these gains
    // copy, this fails and the entry goes.
    for (const code of NO_LOCALISED_COPY) {
      expect(errorsFor('en')[code], `${code} now has English copy`).toBeUndefined();
    }
  });
});

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
