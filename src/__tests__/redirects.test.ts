import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

import { readHeaderRules, readRedirectRules } from '../../scripts/static-config';

/**
 * The whole SEO value of the wizard route removal (GH#102, PR 3) rests on hand-written
 * rules in `public/_redirects` (they were four regex rules in `vercel.json` until the move to
 * Cloudflare, whose redirect grammar has no alternation groups, so each locale is now its own
 * line). How many of the 90 removed addresses Google still holds is not derivable from this
 * repository, so no number is claimed here — what is certain is that a rule which silently
 * stops matching turns every address it covered into a live 404 with every gate green.
 *
 * Same idiom, and the same reason, as `csp.test.ts` one file over: this
 * config is enforced only by a deploy, so a defect in it is invisible to
 * `code:check`, to the type checker and to every other suite here.
 *
 * The specific rot surface is the locale list. The per-locale lines are a HAND
 * COPY of `SUPPORTED_LANGUAGES` minus `en`. Add an eleventh locale to
 * `src/config/languages.ts` and `/xx/wizard` 404s forever, because the sitemap
 * generator, the route table and the prerender count all derive from that
 * constant and this file does not. That is not a hypothetical class in this
 * repo — it was realised once in `api/og.ts`, whose own locale table had lost
 * `fr` and still carried the retired `hi` (GH#87).
 *
 * ⛔ That copy was resolved by DELETING the file rather than repairing the list,
 * and the reason generalises. Nothing pointed at the endpoint: `69e34ee` unwired
 * it in January over a `@vercel/og` x Vite incompatibility and shipped a static
 * `og-image.png`, which `index.html` still serves for all ten locales, because
 * `vite/ssg-meta-injector.ts` emits no `og:image` at all. Repairing the list
 * would have turned a gate green over a surface that renders nothing, reading as
 * "the per-locale cards are correct" — the opposite of the truth. The locale list
 * below is different in the way that decides it: it is live, so it is gated here
 * rather than deleted.
 */

const ROOT = resolve(__dirname, '../..');

const redirects = readRedirectRules(ROOT);
const headers = readHeaderRules(ROOT);

/**
 * Redirect RULES about the removed routes. Deliberately matched on `/wizard/`
 * or a `/wizard` that ends the pattern, so the asset cache-header rule
 * (`/wizard/step-*`, a hyphen) can never be swept in here — the
 * hyphen-versus-slash separation is what keeps 40 files in `public/wizard/`
 * from being redirected away, and a test that blurred it would stop being able
 * to see the difference.
 */
const wizardRedirects = redirects.filter(rule => /\/wizard(\/|$)/.test(rule.source));

/** The locales the redirect rules must name: every supported language but the default. */
const LOCALIZED = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');

/** The locale prefix of a source, or null for the English rules. */
function localeOf(source: string): string | null {
  const match = /^\/([a-z]{2})\/wizard/.exec(source);
  return match ? match[1]! : null;
}

describe('_redirects wizard redirects', () => {
  it('declares exactly the two shapes for the root and for every non-default locale', () => {
    // Two shapes (`/wizard`, `/wizard/step/:step`) × (English at the root + one line per
    // localized prefix). Fewer means an address class is 404ing — a missing locale 404s that
    // market's indexed URLs; more means a rule nobody has reasoned about, or a stale locale
    // (the `hi` shape of GH#87) redirecting a prefix the router no longer serves.
    const expected = ['', ...LOCALIZED.map(lang => `/${lang}`)].flatMap(prefix => [
      `${prefix}/wizard`,
      `${prefix}/wizard/step/:step`,
    ]);

    expect(wizardRedirects.map(rule => rule.source).sort()).toEqual(expected.sort());
  });

  it('makes every one permanent, so the signal consolidates instead of being re-crawled', () => {
    // A rule without a status is a 302 on Cloudflare, and Google would keep the old URL in
    // the index. 308 is what Vercel's `permanent: true` emitted; equivalent to 301 for Google.
    expect(new Set(wizardRedirects.map(rule => rule.status))).toEqual(new Set([308]));
  });

  it('sends every rule to a bare /upload in its own locale, with no query string', () => {
    // The load-bearing decision of this PR. A reader arriving from a Google result must land
    // on the upload page, NOT on a page that immediately throws a full-screen dialog over
    // itself — that is the intrusive-interstitial pattern, on an 85%-mobile audience. Nothing
    // stops a future edit from writing `?step=:step` by hand, which is what this asserts
    // against.
    for (const rule of wizardRedirects) {
      expect(rule.destination, `${rule.source} must not carry a query string`).not.toContain('?');
      // The locale must be carried through: an Indonesian reader redirected to the English
      // `/upload` is dropped out of their own funnel silently.
      const lang = localeOf(rule.source);
      expect(rule.destination).toBe(lang ? `/${lang}/upload` : '/upload');
    }
  });

  it('lists static rules before dynamic ones, as Cloudflare requires', () => {
    const isDynamic = (source: string) => /[:*]/.test(source);
    const firstDynamic = redirects.findIndex(rule => isDynamic(rule.source));
    const staticAfter = redirects.slice(firstDynamic).filter(rule => !isDynamic(rule.source));

    expect(staticAfter).toEqual([]);
  });
});

describe('_headers wizard asset cache header', () => {
  it('caches the step assets by their hyphenated prefix, never the removed routes', () => {
    const rule = headers.find(entry => entry.source.startsWith('/wizard/'));

    expect(rule?.source).toBe('/wizard/step-*');
  });
});
