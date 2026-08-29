import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/languages';

/**
 * ⛔ THIS FILE IS EXPECTED TO BE RED ON `feat/wizard-route-removal`, once per
 * locale. That is what it is for. Read this comment before "fixing" it.
 *
 * The route removal (GH#102, PR 3) has two halves, and the plan says they must
 * land in the same commit:
 *
 *   1. the four `/wizard` 301s in `vercel.json`, which this branch ships; and
 *   2. rewritten `<title>`s for `/upload` — TEN of them, one per locale —
 *      which this branch deliberately does NOT ship.
 *
 * Half 2 is blocked on a Google Search Console export the operator has not
 * delivered, by the growth advisor's explicit decision, and deferring it is the
 * right call: the 80 indexed `/wizard` URLs rank for "how to download your
 * Instagram data as JSON", a 301 re-evaluates the TARGET against those queries,
 * and `/upload`'s titles say nothing about downloading data. Nobody can size
 * that cost without the export, and "we cannot measure it" is an argument for
 * waiting rather than for guessing.
 *
 * What this file fixes is the ENFORCEMENT, not the decision. Until it existed
 * the only thing holding the branch was a note in a PR description, while
 * `code:check`, the full suite and `perf:budget` all said yes — every
 * mechanical gate agreed with merging. This project's own stated remedy for
 * exactly that is "a fact that a test computes cannot silently rot"
 * (`architecture-facts.test.ts`), so here it is as a red check instead of a
 * label somebody has to remember.
 *
 * WHY TEN AND NOT ONE. An earlier draft asserted on `en` alone. That is this
 * repository's most-repeated defect with its axes swapped: nothing anywhere
 * checks `meta.json` across locales — `src/__tests__/locales/` holds seven
 * files and none of them reads it — so an English-only gate goes green the
 * moment one title is written, and nine locales ship a title describing a page
 * whose incoming traffic has changed. `upload-affiliate-keys.test.ts` is the
 * same shape already realised: it derives its LANGUAGE list from
 * `SUPPORTED_LANGUAGES` but enumerates its KEY list by hand, so nine locales
 * passed green while the tenth rendered a raw key on a live page. A gate that
 * reads one locale out of ten is that defect, transposed. Hence the locale list
 * below is derived and never hand-written; only the tripwire VALUES are
 * literals, because a "has this string moved" check has nowhere else to get
 * them from.
 *
 * It encodes NO opinion about the copy, and cannot: the only thing it knows is
 * the string that was there before. Each locale goes green the moment ANY
 * different title is written for it, whatever it says — good, bad, long, short.
 * A one-character change satisfies that locale. The values below are
 * "has this been touched" markers, not a specification, and nothing here should
 * ever be read as review of what replaces them.
 *
 * To retire this gate: when the ten titles land, this file goes green on its
 * own. Delete it once PR 3 is merged — it has no meaning on any later branch.
 */

const ROOT = resolve(__dirname, '../..');

/**
 * `routes["/upload"].title` per locale as it stood BEFORE the rewrite, byte for
 * byte, captured from this branch's base `103173d`. All ten verified identical
 * at `103173d`, at `origin/main` and at `HEAD` on 2026-08-28 — so every one is
 * genuinely a pre-PR value and not something this branch already moved. (Its
 * only edit to any `meta.json` was deleting the `/wizard` route entry.)
 */
const PRE_REDIRECT_UPLOAD_TITLES: Record<SupportedLanguage, string> = {
  en: 'Upload Instagram ZIP: Free Unfollower Analysis',
  ar: 'رفع ملف ZIP من Instagram: تحليل مجاني لمن ألغى متابعتك',
  de: 'Instagram-ZIP hochladen: kostenlose Entfolger-Analyse',
  es: 'Sube tu ZIP de Instagram: quién dejó de seguirte, gratis',
  fr: 'Téléverser un ZIP Instagram : analyse des désabonnements',
  id: 'Upload File ZIP Instagram: Analisis Unfollowers Gratis',
  ja: 'Instagram ZIPをアップロード｜フォローを外された人を無料で確認',
  pt: 'Envie seu ZIP do Instagram: quem deixou de te seguir',
  ru: 'Загрузи ZIP из Instagram: бесплатно узнай, кто отписался',
  tr: 'Instagram ZIP yükle: takipten çıkanları ücretsiz gör',
};

function uploadTitle(lang: SupportedLanguage): string {
  const meta = JSON.parse(readFileSync(resolve(ROOT, `src/locales/${lang}/meta.json`), 'utf8')) as {
    routes: Record<string, { title: string }>;
  };

  const title = meta.routes['/upload']?.title;
  if (typeof title !== 'string') {
    throw new Error(`${lang}/meta.json no longer declares routes["/upload"].title`);
  }
  return title;
}

/** How many `/wizard` redirect rules `vercel.json` ships. Zero before this branch. */
function wizardRedirectCount(): number {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    redirects: Array<{ source: string }>;
  };

  return config.redirects.filter(rule => /\/wizard(\/|$)/.test(rule.source)).length;
}

describe('the /wizard route removal ships with its title rewrite', () => {
  it('records a tripwire value for every supported locale', () => {
    // Guards the guard. An eleventh locale added to SUPPORTED_LANGUAGES has no
    // recorded pre-PR title, and without this it would simply not be checked —
    // the gate would quietly cover 10 of 11 while reading as complete. Fail
    // loudly instead, and make whoever adds the locale record its value.
    const missing = SUPPORTED_LANGUAGES.filter(lang => !(lang in PRE_REDIRECT_UPLOAD_TITLES));

    expect(missing, 'no pre-PR /upload title recorded for these locales').toEqual([]);
  });

  it.each(SUPPORTED_LANGUAGES)(
    'does not 301 indexed URLs into the %s /upload while it still carries its pre-redirect title',
    lang => {
      const shipsRedirects = wizardRedirectCount() > 0;
      const titleIsUntouched = uploadTitle(lang) === PRE_REDIRECT_UPLOAD_TITLES[lang];

      // Deliberately a conjunction rather than two assertions: neither half is a
      // defect on its own. The redirects alone are correct work, and the old
      // titles alone are the state of `main`. Only shipping the first WITHOUT
      // the second is the thing the plan forbids, so only that combination goes
      // red — and it goes red per locale, so the message names which ones are
      // still outstanding rather than stopping at the first.
      expect(
        shipsRedirects && titleIsUntouched,
        `vercel.json ships the /wizard 301s while src/locales/${lang}/meta.json still ` +
          `carries routes["/upload"].title = ${JSON.stringify(PRE_REDIRECT_UPLOAD_TITLES[lang])}. ` +
          'The plan requires all ten titles in the same commit as the redirects. This gate ' +
          'has no opinion about what the new title should say — write any different one ' +
          'for this locale and it goes green.'
      ).toBe(false);
    }
  );
});
