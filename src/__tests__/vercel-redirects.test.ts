import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * The whole SEO value of the wizard route removal (GH#102, PR 3) rests on four
 * hand-written rules in `vercel.json`, and until this file nothing in the
 * repository asserted anything about them: `grep -rn "redirects" src/__tests__`
 * returned nothing. Eighty of the removed addresses are indexed in Google, so a
 * rule that silently stops matching is 80 live 404s with every gate green.
 *
 * Same idiom, and the same reason, as `vercel-csp.test.ts` one file over: this
 * config is enforced only by a deploy, so a defect in it is invisible to
 * `code:check`, to the type checker and to every other suite here.
 *
 * The specific rot surface is the locale alternation. `"/:lang(ar|de|es|…)"` is
 * a HAND COPY of `SUPPORTED_LANGUAGES` minus `en`. Add an eleventh locale to
 * `src/config/languages.ts` and `/xx/wizard` 404s forever, because the sitemap
 * generator, the route table and the prerender count all derive from that
 * constant and this string does not. That is not a hypothetical class in this
 * repo — GH#87 is it, already realised once: `api/og.ts` carries its own locale
 * table, which has no `fr` and still carries the retired `hi`.
 */

const ROOT = resolve(__dirname, '../..');

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
}

interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

function readVercelConfig(): { redirects: VercelRedirect[]; headers: VercelHeaderRule[] } {
  return JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    redirects: VercelRedirect[];
    headers: VercelHeaderRule[];
  };
}

const config = readVercelConfig();

/**
 * Redirect RULES about the removed routes. Deliberately matched on `/wizard/`
 * or a `/wizard` that ends the pattern, so the asset cache-header rule
 * (`/wizard/step-(.*)`, a hyphen) can never be swept in here — the
 * hyphen-versus-slash separation is what keeps 40 files in `public/wizard/`
 * from being redirected away, and a test that blurred it would stop being able
 * to see the difference.
 */
const wizardRedirects = config.redirects.filter(rule => /\/wizard(\/|$)/.test(rule.source));

/** The locales the redirect rules must name: every supported language but the default. */
const LOCALIZED = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');

/** The `(ar|de|…)` group out of a `:lang` capture, or null for the English rules. */
function alternationOf(source: string): string[] | null {
  const match = /:lang\(([^)]+)\)/.exec(source);
  return match ? match[1]!.split('|') : null;
}

describe('vercel.json wizard redirects', () => {
  it('declares exactly the four rules the route removal needs', () => {
    // Two shapes (`/wizard`, `/wizard/step/:step`) × two audiences (English at
    // the root, the nine localized prefixes). Fewer means an address class is
    // 404ing; more means a rule nobody has reasoned about.
    expect(wizardRedirects.map(rule => rule.source).sort()).toEqual([
      `/:lang(${LOCALIZED.join('|')})/wizard`,
      `/:lang(${LOCALIZED.join('|')})/wizard/step/:step`,
      '/wizard',
      '/wizard/step/:step',
    ]);
  });

  it('names every non-default locale in both alternations, and nothing else', () => {
    // This is the assertion the file exists for. Compared as sorted sets, because
    // the order of an alternation is semantically irrelevant — what matters is
    // that the membership is identical to SUPPORTED_LANGUAGES minus `en`, in
    // both directions: a missing locale 404s that market's indexed URLs, and a
    // stale extra one (the `hi` shape of GH#87) redirects a prefix the router no
    // longer serves.
    const alternations = wizardRedirects.map(rule => alternationOf(rule.source)).filter(Boolean);

    expect(alternations).toHaveLength(2);

    for (const alternation of alternations) {
      expect([...alternation!].sort()).toEqual([...LOCALIZED].sort());
    }
  });

  it('makes all four permanent, so the signal consolidates instead of being re-crawled', () => {
    // `permanent: true` is what Vercel turns into a permanent status; a rule that
    // lost it would silently become temporary and Google would keep the old URL
    // in the index. (The status it emits is 308, not 301 — `superstatic`'s
    // `status = r.permanent ? 308 : 307`. Equivalent for Google; the number is
    // worth knowing before someone curls a preview and reads 308 as a failure.)
    expect(wizardRedirects.map(rule => rule.permanent)).toEqual([true, true, true, true]);
  });

  it('sends every rule to a bare /upload, with no query string', () => {
    // The load-bearing decision of this PR, and it was pinned by nothing. A
    // reader arriving from a Google result must land on the upload page, NOT on
    // a page that immediately throws a full-screen dialog over itself — that is
    // the intrusive-interstitial pattern, on an 85%-mobile audience.
    //
    // It survives today only because `superstatic` discards unused path params
    // on redirects (the append loop is gated on `!isRedirect`), so the `:step`
    // capture never reaches the destination. Nothing stops a future edit from
    // writing `?step=:step` by hand, which is what this asserts against.
    expect(new Set(wizardRedirects.map(rule => rule.destination))).toEqual(
      new Set(['/upload', '/:lang/upload'])
    );

    for (const rule of wizardRedirects) {
      expect(rule.destination, `${rule.source} must not carry a query string`).not.toContain('?');
      // The locale must be carried through: an Indonesian reader redirected to
      // the English `/upload` is dropped out of their own funnel silently.
      expect(rule.destination).toBe(alternationOf(rule.source) ? '/:lang/upload' : '/upload');
    }
  });
});

describe('vercel.json wizard asset cache header', () => {
  it('matches the step assets with a capture group, not a repeated segment', () => {
    // `"/wizard/step-:file*"` compiles under Vercel's own bundled
    // path-to-regexp@6.1.0 to `^\/wizard\/step-([^\/]+?)*$` — a nested
    // quantifier. Measured against a non-matching input (`/wizard/step-` + N
    // × `a` + `/`): 12.6 ms at 18 characters, 33 ms at 22, 112 ms at 24,
    // 422 ms at 26 — roughly ×4 per character. `(.*)` runs the same input in
    // 0.045 ms, matches all 40 files in `public/wizard/`, and matches none of
    // the removed routes. It is also the form the rest of this file already
    // uses (`/assets/(.*)`, `/affiliate/(.*)`).
    const rule = config.headers.find(entry => entry.source.startsWith('/wizard/'));

    expect(rule?.source).toBe('/wizard/step-(.*)');
  });
});
