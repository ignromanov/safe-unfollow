import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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
 */
const VERCEL = JSON.parse(
  readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'),
) as { headers: VercelHeaderRule[] };

const noindex = (source: string): VercelHeaderRule => ({
  source,
  headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
});

describe('routes the site serves as noindex', () => {
  it('reads the shipped config, not a fixture', () => {
    // Guards the guard: an empty rule list would satisfy every negative assertion below.
    expect(VERCEL.headers.length).toBeGreaterThan(5);
  });

  it('matches /results and /sample from vercel.json as it actually stands', () => {
    const routes = noindexRoutes(VERCEL.headers);
    expect(routes.matches('/results')).toBe(true);
    expect(routes.matches('/sample')).toBe(true);
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
