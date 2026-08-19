import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * One sentence, two namespaces. The same control — "I already have my ZIP
 * file" — sits in the hero and on the wizard's entry screen, and each surface
 * loads its own bundle, so the string is stored twice by construction.
 *
 * Nothing kept the two copies together, and they had already drifted in two
 * languages by the time anyone looked: `ar` had lost the word "already" on the
 * hero side, which is the whole meaning of the control, and `de` had two word
 * orders. #81 is the same failure on a different pair of keys — one branch
 * fixed one copy, another fixed the other, and the merge exposed it.
 *
 * This asserts identity rather than mere presence: if a translator ever needs
 * the two surfaces to read differently, that is a deliberate change to make
 * here first, not something to discover from a screenshot.
 */
const HERO = import.meta.glob<Record<string, any>>('../../locales/*/hero.json', {
  eager: true,
  import: 'default',
});
const WIZARD = import.meta.glob<Record<string, any>>('../../locales/*/wizard.json', {
  eager: true,
  import: 'default',
});

function bundleFor(bundles: Record<string, Record<string, any>>, language: string, name: string) {
  const entry = Object.entries(bundles).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no ${name}.json for ${language}`);
  return entry[1];
}

describe('the "I already have my ZIP file" control', () => {
  it('reads identically in the hero and in the wizard, in every language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const hero = bundleFor(HERO, language, 'hero');
      const wizard = bundleFor(WIZARD, language, 'wizard');

      expect(hero.buttons?.haveFile, `${language} hero:buttons.haveFile`).toBeTruthy();
      expect(wizard.buttons?.alreadyHaveFile, `${language} wizard:buttons.alreadyHaveFile`).toBe(
        hero.buttons.haveFile
      );
    }
  });
});
