import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

import { noindexRoutes, type HeaderRule } from '../../../scripts/noindex-routes';
import { readHeaderRules } from '../../../scripts/static-config';

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
 * ⛔ What "matches _headers as it actually stands" does NOT cover, and why the locale test
 * exists: `noindexRoutes().matches()` is called on the base path, after `parseUrlPath()` has
 * already stripped any locale prefix by membership in `SUPPORTED_LANGUAGES`. That derivation
 * is correct by construction on the sitemap side. But the header side — one `/<lang>/results`
 * rule per locale in `public/_headers`, because the file has no regex groups — is a HAND COPY
 * of that same locale list, exactly the shape `static-redirects.test.ts` gates for the
 * `/wizard` redirects. Add an eleventh locale and the sitemap excludes `/xx/results` for free,
 * while no header rule covers it — the page becomes indexable and unlisted at once, which is
 * invisible because nothing points a crawler back at it. A stale locale left behind after a
 * retirement (the `hi` shape of GH#87) fails the same way in reverse.
 */
const HEADERS = readHeaderRules();

const noindex = (source: string): HeaderRule => ({
  source,
  headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
});

/** Every noindex header rule (X-Robots-Tag containing "noindex") in the shipped config. */
const noindexHeaderRules = HEADERS.filter(rule =>
  rule.headers.some(
    header => header.key.toLowerCase() === 'x-robots-tag' && /\bnoindex\b/i.test(header.value),
  ),
);

describe('routes the site serves as noindex', () => {
  it('reads the shipped config, not a fixture', () => {
    // Guards the guard: an empty rule list would satisfy every negative assertion below.
    expect(HEADERS.length).toBeGreaterThan(5);
  });

  it('matches /results and /sample from _headers as it actually stands, on the base path', () => {
    const routes = noindexRoutes(HEADERS);
    expect(routes.matches('/results')).toBe(true);
    expect(routes.matches('/sample')).toBe(true);
  });

  it('gives every noindexed base path one rule per non-default locale, and nothing else', () => {
    // Found structurally — filtered by carrying X-Robots-Tag: noindex, then grouped by the path
    // after a two-letter first segment — never by a literal copy of the locale list, which
    // would just re-create the defect this test exists to catch.
    const localized = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');
    const byBase = new Map<string, string[]>();
    for (const { source } of noindexHeaderRules) {
      const match = /^\/([a-z]{2})(\/[a-z0-9-]+)$/.exec(source);
      if (!match) continue;
      byBase.set(match[2]!, [...(byBase.get(match[2]!) ?? []), match[1]!]);
    }

    // Guards the guard: zero rules found would make the set-equality assertion below vacuous.
    expect([...byBase.keys()].sort()).toEqual(['/results', '/sample']);

    for (const [base, langs] of byBase) {
      expect([...langs].sort(), base).toEqual([...localized].sort());
      // The English page has no prefix, so it needs its own rule.
      expect(noindexHeaderRules.some(rule => rule.source === base), base).toBe(true);
    }
  });

  it('leaves every other published route alone', () => {
    const routes = noindexRoutes(HEADERS);
    for (const kept of ['/', '/upload', '/waiting', '/privacy', '/terms', '/docs', '/docs/faq']) {
      expect(routes.matches(kept), `${kept} would vanish from the sitemap`).toBe(false);
    }
  });

  it('strips a locale prefix, so every variant lands on one base path', () => {
    // parseUrlPath() turns /id/results into basePath /results before this is consulted, so a
    // locale rule must collapse onto the same entry as the English one.
    const routes = noindexRoutes([noindex('/results'), noindex('/id/results'), noindex('/de/sample')]);
    expect([...routes.exact].sort()).toEqual(['/results', '/sample']);
    expect(routes.exact.has('/id/results')).toBe(false);
  });

  it('ignores a rule scoped to another host', () => {
    // The workers.dev copies are noindexed wholesale; that is not a statement about any route
    // on safeunfollow.app, and must not trip the site-wide refusal below.
    const routes = noindexRoutes([noindex('https://:name.:subdomain.workers.dev/*')]);
    expect(routes.exact.size + routes.prefixes.length).toBe(0);
  });

  it('treats a trailing wildcard as a prefix', () => {
    const routes = noindexRoutes([noindex('/affiliate/*')]);
    expect(routes.matches('/affiliate')).toBe(true);
    expect(routes.matches('/affiliate/nordvpn')).toBe(true);
    expect(routes.matches('/affiliates')).toBe(false);
  });

  it('ignores a rule that carries no X-Robots-Tag', () => {
    const routes = noindexRoutes([
      { source: '/assets/*', headers: [{ key: 'Cache-Control', value: 'public' }] },
    ]);
    expect(routes.exact.size + routes.prefixes.length).toBe(0);
  });

  it('refuses a shape it does not understand instead of ignoring it', () => {
    expect(() => noindexRoutes([noindex('/a/:b/c/*')])).toThrow(/unrecognised/);
  });

  it('refuses a site-wide noindex rather than emptying the sitemap', () => {
    expect(() => noindexRoutes([noindex('/*')])).toThrow(/site-wide/);
  });
});
