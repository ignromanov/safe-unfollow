import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { WIZARD_STEPS } from '@/config/wizard-steps';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/wizard.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, any> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no wizard.json for ${language}`);
  return entry[1] as Record<string, any>;
}

function lookup(bundle: Record<string, any>, key: string): string | undefined {
  let value: unknown = bundle;
  for (const part of key.split('.')) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * Mirrors i18next's own key resolution order closely enough to catch a
 * missing key without booting the real library (i18next/src/Translator.js
 * `resolve()`): a `count` option always computes the CLDR plural category
 * for the language and tries `${key}_${category}` first, falling through to
 * the bare `key` only if that suffixed form is absent.
 */
function resolveAsRealI18nextWould(
  bundle: Record<string, any>,
  key: string,
  language: string,
  count: number
): string | undefined {
  const category = new Intl.PluralRules(language).select(count);
  return lookup(bundle, `${key}_${category}`) ?? lookup(bundle, key);
}

// StepAccordion.tsx's label ("Step-by-step guide — N steps") — Critical
// finding from the final whole-branch review of PR-2: real i18next resolves
// the CLDR plural category for `{ count }` and does not fall back to
// `_other`, so a locale defining only `_one`/`_other` prints the raw key for
// any language/count whose category is `few`/`many`/etc. (Russian and
// Arabic both hit this at the real step count). The mock in
// src/__tests__/utils/mockI18n.ts always collapses non-1 counts to
// `_other`, so it cannot see this bug — this test resolves against the real
// locale JSON instead.
describe('wizard entry accordion trigger — plural resolution', () => {
  const REAL_STEP_COUNT = WIZARD_STEPS.length - 1; // StepAccordion excludes step 1

  it('resolves entry.accordion.trigger for every supported language at the real step count', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      const resolved = resolveAsRealI18nextWould(
        bundle,
        'entry.accordion.trigger',
        language,
        REAL_STEP_COUNT
      );

      expect(
        resolved,
        `${language} entry.accordion.trigger at count=${REAL_STEP_COUNT}`
      ).toBeTruthy();
      expect(resolved, language).toContain('{{count}}');
    }
  });

  it('defines the key as a single un-suffixed form, not a `_one`/`_other` split', () => {
    // A stray plural-suffixed sibling would reintroduce the original bug for
    // whichever CLDR category the split does not cover — see
    // StepAccordion.tsx's comment on `stepCount` for why a bare key is
    // deliberate here.
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      const accordion = bundle.entry?.accordion ?? {};

      expect(Object.keys(accordion), language).toEqual(['trigger']);
    }
  });
});
