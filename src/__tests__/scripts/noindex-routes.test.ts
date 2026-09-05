import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

import { noindexRoutes, type VercelHeaderRule } from '../../../scripts/noindex-routes';

/**
 * The sitemap and the X-Robots-Tag header have to agree, and the only way to guarantee that is
 * for one of them to be derived from the other. This tests the derivation.
 *
 * The failure being prevented is not hypothetical: advertising a URL in a sitemap while serving
 * it `noindex` asks Google to spend crawl budget on a page we have just told it to discard, and
 * the two facts live in different files maintained by different tasks.
 *
 * The refusals matter as much as the matches. An unrecognised `source` shape throws rather than
 * falling through, because falling through means the route quietly stays in the sitemap - green,
 * and wrong. A site-wide noindex throws too: expanding it would empty the sitemap, which is a
 * catastrophic action to take on a config typo.
 *
 * ⛔ What "matches vercel.json as it actually stands" does NOT cover, and why the next test
 * exists: `noindexRoutes().matches()` is called on the base path, after `parseUrlPath()` has
 * already stripped any locale prefix by membership in `SUPPORTED_LANGUAGES`. That derivation
 * is correct by construction on the sitemap side. But the header side —
 * `/:lang(ar|de|es|fr|id|ja|pt|ru|tr)/:path(results|sample)` in vercel.json — is a HAND COPY
 * of that same locale list, exactly the shape `vercel-redirects.test.ts` already gates for the
 * `/wizard` redirects (same file, two rules up). Add an eleventh locale and nothing here would
 * fail: the sitemap excludes `/xx/results` for free (base-path derivation), while the header
 * rule silently fails to cover it — the page becomes indexable and unlisted at once, which is
 * invisible because nothing points a crawler back at it. A stale locale left behind after a
 * retirement (the `hi` shape of GH#87) fails the same way in reverse.
 */
const VERCEL = JSON.parse(
  readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'),
) as { headers: VercelHeaderRule[] };

const noindex = (source: string): VercelHeaderRule => ({
  source,
  headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
});

/** The `(ar|de|…)` group out of a `:lang` capture, or null when the source has none. */
function langAlternationOf(source: string): string[] | null {
  const match = /:lang\(([^)]+)\)/.exec(source);
  return match ? match[1]!.split('|') : null;
}

/** Every noindex header rule (X-Robots-Tag containing "noindex") in the shipped config. */
const noindexHeaderRules = VERCEL.headers.filter(rule =>
  rule.headers.some(
    header => header.key.toLowerCase() === 'x-robots-tag' && /\bnoindex\b/i.test(header.value),
  ),
);

describe('routes the site serves as noindex', () => {
  it('reads the shipped config, not a fixture', () => {
    // Guards the guard: an empty rule list would satisfy every negative assertion below.
    expect(VERCEL.headers.length).toBeGreaterThan(5);
  });

  it('matches /results and /sample from vercel.json as it actually stands, on the base path', () => {
    const routes = noindexRoutes(VERCEL.headers);
    expect(routes.matches('/results')).toBe(true);
    expect(routes.matches('/sample')).toBe(true);
  });

  it('names every non-default locale in the noindex :lang alternation, and nothing else', () => {
    // Found structurally — filtered by carrying X-Robots-Tag: noindex, then by source shape —
    // never by index or by a literal copy of the locale list, which would just re-create the
    // defect this test exists to catch.
    const localized = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');
    const alternations = noindexHeaderRules
      .map(rule => langAlternationOf(rule.source))
      .filter((alternation): alternation is string[] => alternation !== null);

    // Guards the guard: zero rules found would make the set-equality assertion below vacuous.
    expect(alternations.length).toBeGreaterThan(0);

    for (const alternation of alternations) {
      expect([...alternation].sort()).toEqual([...localized].sort());
    }
  });

  it('leaves every other published route alone', () => {
    const routes = noindexRoutes(VERCEL.headers);
    for (const kept of ['/', '/upload', '/waiting', '/privacy', '/terms', '/docs', '/docs/faq']) {
      expect(routes.matches(kept), `${kept} would vanish from the sitemap`).toBe(false);
    }
  });

  it('covers a locale variant through the base path, not a second rule', () => {
    // parseUrlPath() turns /id/results into basePath /results before this is consulted, which
    // is why one rule covers all ten locales. Asserted here so that contract is written down.
    const routes = noindexRoutes([noindex('/:path(results|sample)')]);
    expect(routes.matches('/results')).toBe(true);
    expect(routes.exact.has('/id/results')).toBe(false);
  });

  it('expands an alternation group and strips a locale prefix', () => {
    const routes = noindexRoutes([noindex('/:lang(ar|de|id)/:path(results|sample)')]);
    expect([...routes.exact].sort()).toEqual(['/results', '/sample']);
  });

  it('treats a trailing wildcard as a prefix', () => {
    const routes = noindexRoutes([noindex('/affiliate/(.*)')]);
    expect(routes.matches('/affiliate')).toBe(true);
    expect(routes.matches('/affiliate/nordvpn')).toBe(true);
    expect(routes.matches('/affiliates')).toBe(false);
  });

  it('ignores a rule that carries no X-Robots-Tag', () => {
    const routes = noindexRoutes([
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public' }] },
    ]);
    expect(routes.exact.size + routes.prefixes.length).toBe(0);
  });

  it('refuses a shape it does not understand instead of ignoring it', () => {
    expect(() => noindexRoutes([noindex('/a/:b/c/:d*')])).toThrow(/unrecognised/);
  });

  it('refuses a site-wide noindex rather than emptying the sitemap', () => {
    expect(() => noindexRoutes([noindex('/(.*)')])).toThrow(/site-wide/);
  });
});
