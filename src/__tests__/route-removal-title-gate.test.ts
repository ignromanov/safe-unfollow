import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/languages';

/**
 * ⛔ THIS FILE IS EXPECTED TO BE RED ON `feat/wizard-route-removal`, thirty
 * times over. That is what it is for. Read this comment before "fixing" it.
 *
 * The route removal (GH#102, PR 3) has two halves, and the plan says they must
 * land in the same commit:
 *
 *   1. the four `/wizard` 301s in `vercel.json`, which this branch ships; and
 *   2. a rewritten `/upload` meta TRIPLE — `title`, `description`, `ogTitle` —
 *      in each of ten locales, which this branch deliberately does NOT ship.
 *
 * Half 2 is blocked on a Google Search Console export the operator has not
 * delivered, by the growth advisor's explicit decision, and deferring it is the
 * right call: the 80 indexed `/wizard` URLs rank for "how to download your
 * Instagram data as JSON", a 301 re-evaluates the TARGET against those queries,
 * and `/upload`'s copy says nothing about downloading data. Nobody can size
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
 * WHY THIRTY AND NOT ONE. This gate has been widened twice, both times because
 * a narrower version would have gone green while most of the required work was
 * untouched — the same defect on two different axes:
 *
 *   - ACROSS LOCALES. An `en`-only gate passes the moment one locale is
 *     written, and nine ship copy describing a page whose incoming traffic has
 *     changed. `upload-affiliate-keys.test.ts` is that shape already realised:
 *     it derives its LANGUAGE list from `SUPPORTED_LANGUAGES` but enumerates
 *     its KEY list by hand, so nine locales passed green while the tenth
 *     rendered a raw key on a live page.
 *   - ACROSS FIELDS. A `title`-only gate passes with two thirds of each locale
 *     untouched. That is not a copy judgement withheld — it is a WEAKER version
 *     of the plan's own requirement, applied silently. The plan's Task 4 Step 2
 *     says the triple, and lumen-cro's decision of 2026-08-28 independently
 *     requires `description` to be rewritten whole (`en` measures 158
 *     characters against a 160 cap, replacement specified at 150).
 *
 * So the locale list is derived from `SUPPORTED_LANGUAGES` and the field list
 * is fixed at the three keys every locale carries; neither is hand-enumerated
 * per case. Only the thirty tripwire VALUES are literals, because a "has this
 * string moved" check has nowhere else to get them from.
 *
 * It encodes NO opinion about the copy, and cannot: the only thing it knows is
 * the string that was there before. Each of the thirty slots goes green the
 * moment ANY different value is written for it, whatever it says — good, bad,
 * long, short. A one-character change satisfies that slot. These are
 * "has this been touched" markers, not a specification, and nothing here should
 * ever be read as review of what replaces them.
 *
 * To retire this gate: when the thirty values land, this file goes green on its
 * own. Delete it once PR 3 is merged — it has no meaning on any later branch.
 */

const ROOT = resolve(__dirname, '../..');

/** The three keys `routes["/upload"]` carries in every locale, verified 2026-08-28. */
const META_FIELDS = ['title', 'description', 'ogTitle'] as const;
type MetaField = (typeof META_FIELDS)[number];

/**
 * `routes["/upload"]` per locale as it stood BEFORE the rewrite, byte for byte,
 * captured from this branch's base `103173d`. All thirty values verified
 * identical at `103173d`, at `origin/main` and at `HEAD` on 2026-08-28 — so
 * every one is genuinely a pre-PR value and not something this branch already
 * moved. (Its only edit to any `meta.json` was deleting the `/wizard` route
 * entry from `en`.)
 *
 * Note for whoever rewrites these: `title` and `ogTitle` are currently
 * IDENTICAL in all ten locales. That is a convention, not a rule, and this gate
 * deliberately does not enforce it — the two are separate slots, and either may
 * move without the other.
 */
const PRE_REDIRECT_UPLOAD_META: Record<SupportedLanguage, Record<MetaField, string>> = {
  en: {
    title: 'Upload Instagram ZIP: Free Unfollower Analysis',
    description:
      'Upload your Instagram data export (ZIP) for a free unfollower analysis. No login and no password: the file is parsed in your browser and stays on your device.',
    ogTitle: 'Upload Instagram ZIP: Free Unfollower Analysis',
  },
  ar: {
    title: 'رفع ملف ZIP من Instagram: تحليل مجاني لمن ألغى متابعتك',
    description:
      'لتحليل مجاني لمن ألغى متابعتك: يكفي رفع ملف تصدير بيانات Instagram (ZIP). بدون تسجيل دخول وبدون كلمة مرور، ويُقرأ الملف داخل متصفحك ويبقى على جهازك.',
    ogTitle: 'رفع ملف ZIP من Instagram: تحليل مجاني لمن ألغى متابعتك',
  },
  de: {
    title: 'Instagram-ZIP hochladen: kostenlose Entfolger-Analyse',
    description:
      'Lade deinen Instagram-Export (ZIP) hoch für eine kostenlose Entfolger-Analyse. Ohne Login, ohne Passwort: die Datei wird im Browser gelesen und bleibt bei dir.',
    ogTitle: 'Instagram-ZIP hochladen: kostenlose Entfolger-Analyse',
  },
  es: {
    title: 'Sube tu ZIP de Instagram: quién dejó de seguirte, gratis',
    description:
      'Sube tu exportación de datos de Instagram (ZIP) y ve gratis quién dejó de seguirte. Sin iniciar sesión y sin contraseña: el archivo se lee en tu navegador.',
    ogTitle: 'Sube tu ZIP de Instagram: quién dejó de seguirte, gratis',
  },
  fr: {
    title: 'Téléverser un ZIP Instagram : analyse des désabonnements',
    description:
      'Téléversez votre export Instagram (ZIP) pour une analyse gratuite des désabonnements. Sans identifiants ni mot de passe : le fichier est lu dans le navigateur.',
    ogTitle: 'Téléverser un ZIP Instagram : analyse des désabonnements',
  },
  id: {
    title: 'Upload File ZIP Instagram: Analisis Unfollowers Gratis',
    description:
      'Upload ekspor data Instagram (ZIP) untuk analisis unfollowers gratis. Tanpa login dan tanpa password: file dibaca di browser Anda dan tetap di perangkat.',
    ogTitle: 'Upload File ZIP Instagram: Analisis Unfollowers Gratis',
  },
  ja: {
    title: 'Instagram ZIPをアップロード｜フォローを外された人を無料で確認',
    description:
      'Instagramのデータエクスポート（ZIP）をアップロードすると、フォローを外された人を無料で確認できます。ログインもパスワードも不要。ファイルはブラウザの中で読み込まれ、端末から出ません。',
    ogTitle: 'Instagram ZIPをアップロード｜フォローを外された人を無料で確認',
  },
  pt: {
    title: 'Envie seu ZIP do Instagram: quem deixou de te seguir',
    description:
      'Envie sua exportação de dados do Instagram (ZIP) e veja de graça quem deixou de te seguir. Sem login e sem senha: o arquivo é lido dentro do seu navegador.',
    ogTitle: 'Envie seu ZIP do Instagram: quem deixou de te seguir',
  },
  ru: {
    title: 'Загрузи ZIP из Instagram: бесплатно узнай, кто отписался',
    description:
      'Загрузи выгрузку данных инстаграма (ZIP) и бесплатно узнай, кто отписался. Без входа и пароля: файл разбирается в твоём браузере и остаётся на устройстве.',
    ogTitle: 'Загрузи ZIP из Instagram: бесплатно узнай, кто отписался',
  },
  tr: {
    title: 'Instagram ZIP yükle: takipten çıkanları ücretsiz gör',
    description:
      'Instagram veri dışa aktarımını (ZIP) yükle, takipten çıkanları ücretsiz gör. Giriş yok, şifre yok: dosya tarayıcında okunur ve cihazından hiç çıkmaz.',
    ogTitle: 'Instagram ZIP yükle: takipten çıkanları ücretsiz gör',
  },
};

function uploadMeta(lang: SupportedLanguage): Record<string, string> {
  const meta = JSON.parse(readFileSync(resolve(ROOT, `src/locales/${lang}/meta.json`), 'utf8')) as {
    routes: Record<string, Record<string, string>>;
  };

  const upload = meta.routes['/upload'];
  if (!upload) throw new Error(`${lang}/meta.json no longer declares routes["/upload"]`);
  return upload;
}

/** How many `/wizard` redirect rules `vercel.json` ships. Zero before this branch. */
function wizardRedirectCount(): number {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    redirects: Array<{ source: string }>;
  };

  return config.redirects.filter(rule => /\/wizard(\/|$)/.test(rule.source)).length;
}

/** The thirty slots, derived — ten locales x the three fields, never hand-listed. */
const SLOTS = SUPPORTED_LANGUAGES.flatMap(lang => META_FIELDS.map(field => ({ lang, field })));

describe('the /wizard route removal ships with its meta rewrite', () => {
  it('records a tripwire value for every supported locale and field', () => {
    // Guards the guard, on both axes. An eleventh locale added to
    // SUPPORTED_LANGUAGES has no recorded pre-PR values, and a locale that
    // grows or loses one of the three keys would otherwise be compared against
    // `undefined` — either way the slot would quietly stop being checked while
    // the gate still read as complete. Fail loudly instead.
    const missing = SLOTS.filter(
      ({ lang, field }) => typeof PRE_REDIRECT_UPLOAD_META[lang]?.[field] !== 'string'
    ).map(({ lang, field }) => `${lang}.${field}`);

    expect(missing, 'no pre-PR /upload value recorded for these slots').toEqual([]);
  });

  it.each(SLOTS)(
    'does not 301 indexed URLs into $lang /upload while its $field still carries the pre-redirect value',
    ({ lang, field }) => {
      const tripwire = PRE_REDIRECT_UPLOAD_META[lang][field];
      const current = uploadMeta(lang)[field];

      // A DELETED key is not a rewritten one. Without this the slot would pass
      // for the wrong reason — `undefined !== tripwire` reads as "this moved" —
      // so a restructure that dropped `ogTitle` from a locale would turn its
      // three slots green while the page lost a meta tag. Asserting the key
      // still exists is not an opinion about what it says.
      expect(
        typeof current,
        `src/locales/${lang}/meta.json no longer declares routes["/upload"].${field}`
      ).toBe('string');

      const shipsRedirects = wizardRedirectCount() > 0;
      const valueIsUntouched = current === tripwire;

      // Deliberately a conjunction rather than two assertions: neither half is a
      // defect on its own. The redirects alone are correct work, and the old
      // copy alone is the state of `main`. Only shipping the first WITHOUT the
      // second is the thing the plan forbids, so only that combination goes red
      // — and it goes red per locale AND per field, so the run names which of
      // the thirty values are still outstanding rather than stopping at the
      // first, or reporting a whole locale when one field is left.
      expect(
        shipsRedirects && valueIsUntouched,
        `vercel.json ships the /wizard 301s while src/locales/${lang}/meta.json still ` +
          `carries routes["/upload"].${field} = ${JSON.stringify(tripwire)}. The plan ` +
          'requires the whole triple (title, description, ogTitle) in all ten locales, in ' +
          'the same commit as the redirects. This gate has no opinion about what the new ' +
          'value should say — write any different one for this slot and it goes green.'
      ).toBe(false);
    }
  );
});
