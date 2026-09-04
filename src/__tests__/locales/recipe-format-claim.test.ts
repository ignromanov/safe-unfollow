import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/wizard.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, any> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no wizard.json for ${language}`);
  return entry[1] as Record<string, any>;
}

/**
 * `entry.recipe.rows.format` states which export formats the product accepts.
 * That is a product claim, not decorative copy — it tells the ~25% of arrivals
 * holding an HTML export whether their file is the right kind — so it is pinned
 * by value, the way `monetization-claims.test.ts` pins the claims it bans.
 *
 * The regression this guards: `34e07e5` (#152) shipped HTML support and changed
 * this row to "JSON or HTML"; two days later `a1e190d` (#151, GH#102 PR-2) set
 * all ten locales back to the pre-#152 string while rebuilding the wizard into
 * the dialog. Different branch lineages, so no conflict and no gate — it was
 * live on `/upload` for six days, contradicting `steps.6.description` in its
 * own bundle. `RecipeCard.test.tsx` could not see it: that test substitutes
 * this value at runtime, so it asserts the token renders, never that the text
 * is the intended one.
 *
 * ⛔ LIMIT, so this is not mistaken for more than it is: the denylist below
 * catches a re-revert to *that* wording. It does not catch a third wording that
 * also excludes HTML. The general invariant — a locale value gated against any
 * previous value of itself — is NOT built here and remains open; `progress.md`
 * P1 row 14 (`aeae028`'s 40-strings-by-six-`›` invariant) is the same class one
 * file over.
 */

// The wording `34e07e5` (#152) shipped, restored 2026-09-04. English only:
// equality across all ten would fire on every legitimate re-translation, and a
// gate people learn to edit rather than obey is worse than none.
const INTENDED_EN_FORMAT = 'JSON or HTML';

// Pinned beside it deliberately: these two keys render on the same screen and
// are the pair that contradicted each other. Pinning one lets them drift apart
// again in the other direction.
const INTENDED_EN_STEP_6 =
  'Click "Format" › Select "JSON". HTML exports also work, but JSON is the format we read most reliably.';

// The superseded strings `a1e190d` (#151) restored, per locale, recorded
// 2026-09-04. This is a historical set, not a list of current locales: a locale
// added after #151 cannot have been reverted by it and correctly has no entry.
const SUPERSEDED_BY_151: Record<string, string> = {
  ar: 'JSON — وليس HTML',
  de: 'JSON — nicht HTML',
  en: 'JSON — not HTML',
  es: 'JSON — no HTML',
  fr: 'JSON — pas HTML',
  id: 'JSON — bukan HTML',
  ja: 'JSON — HTMLではない',
  pt: 'JSON — não HTML',
  ru: 'JSON — не HTML',
  tr: 'JSON — HTML değil',
};

describe('the recipe card states which export formats are accepted', () => {
  it('pins the English format row and the step that must agree with it', () => {
    const en = bundleFor('en');
    expect(en.entry.recipe.rows.format).toBe(INTENDED_EN_FORMAT);
    expect(en.steps['6'].description).toBe(INTENDED_EN_STEP_6);
  });

  it.each(SUPPORTED_LANGUAGES)('states a format for %s', language => {
    const value = bundleFor(language).entry?.recipe?.rows?.format;
    expect(typeof value).toBe('string');
    expect(value.trim()).not.toBe('');
  });

  it.each(Object.keys(SUPERSEDED_BY_151))(
    'has not restored the superseded pre-#152 wording in %s',
    language => {
      expect(bundleFor(language).entry.recipe.rows.format).not.toBe(SUPERSEDED_BY_151[language]);
    }
  );
});
