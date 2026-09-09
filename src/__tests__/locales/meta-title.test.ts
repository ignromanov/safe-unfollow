import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * Every `<title>` the injector writes comes from `meta.json` — the top-level `title` for the
 * homepage and `routes[path].title` for every other prerendered page. A title past the SERP
 * budget is truncated by Google, and the truncation lands on the tail, which is where a brand
 * token sits. The budget is a heuristic (Google measures pixels, ~600px), and 60 characters is
 * the figure the docs gate (`serp-presentation.test.ts`) already holds the Jekyll pages to;
 * the app pages had no gate at all until 2026-09-08, and one shipped title was over it.
 *
 * The entity test is the second half of one edit: the homepage title gained the brand token
 * (`| SafeUnfollow`) so that the domain's own front page names the entity to an engine — four
 * of five AI engines resolved the string to a namesake Chrome extension while our homepage
 * never said the word. The claim and the gate move together; remove one and the other is
 * meant to go red.
 */
const TITLE_BUDGET = 60;
const ENTITY = 'SafeUnfollow';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/meta.json', {
  eager: true,
  import: 'default',
});

interface MetaBundle {
  title?: string;
  routes?: Record<string, { title?: string } | undefined>;
}

function bundleFor(language: string): MetaBundle {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no meta.json for ${language}`);
  return entry[1] as MetaBundle;
}

/** Every `<title>` a locale's meta.json can produce, keyed the way the injector addresses it. */
function titlesOf(bundle: MetaBundle): Array<[key: string, title: string]> {
  const out: Array<[string, string]> = [];
  if (typeof bundle.title === 'string') out.push(['title', bundle.title]);
  for (const [path, route] of Object.entries(bundle.routes ?? {})) {
    if (typeof route?.title === 'string') out.push([`routes.${path}.title`, route.title]);
  }
  return out;
}

function overBudget(title: string): boolean {
  return title.length > TITLE_BUDGET;
}

describe('meta.json titles', () => {
  it(`stays within the ${TITLE_BUDGET}-character SERP budget in every supported language`, () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const titles = titlesOf(bundleFor(language));
      expect(titles.length, `${language} exposes no titles at all`).toBeGreaterThan(0);
      for (const [key, title] of titles) {
        expect(overBudget(title), `${language} ${key} is ${title.length} chars: "${title}"`).toBe(
          false
        );
      }
    }
  });

  it('can still tell an over-budget title from one on the line', () => {
    // Control for the gate above: a checker that never fires would leave every locale green
    // for the wrong reason.
    expect(overBudget('x'.repeat(TITLE_BUDGET))).toBe(false);
    expect(overBudget('x'.repeat(TITLE_BUDGET + 1))).toBe(true);
  });

  it('names the entity once on the English homepage, after the head term', () => {
    const title = bundleFor('en').title ?? '';
    const mentions = title.split(ENTITY).length - 1;
    expect(mentions, `en title: "${title}"`).toBe(1);
    // The measured surface leads: this title is the snippet for `unfollowers tracker`, the
    // property's largest query, and the brand token is a suffix to it, never a replacement.
    expect(title.startsWith('Instagram Unfollowers'), `en title: "${title}"`).toBe(true);
    expect(title.endsWith(`| ${ENTITY}`), `en title: "${title}"`).toBe(true);
  });

  it('spells the entity one way, never split', () => {
    // `og:site_name` and the PWA manifest still say "Safe Unfollow"; the title must not add a
    // third spelling of the same name.
    for (const language of SUPPORTED_LANGUAGES) {
      for (const [key, title] of titlesOf(bundleFor(language))) {
        expect(title, `${language} ${key}`).not.toMatch(/Safe Unfollow/);
      }
    }
  });
});
