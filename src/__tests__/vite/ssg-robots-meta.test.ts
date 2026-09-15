import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyRobotsMeta } from '../../../vite/ssg-meta-injector';
import { noindexRoutes, type VercelHeaderRule } from '../../../scripts/noindex-routes';

/**
 * `index.html:188` hardcodes `<meta name="robots" content="index, follow" />` and every
 * prerendered page inherits it — including the twenty paths `vercel.json` serves with
 * `X-Robots-Tag: noindex` (GH#257). Google resolves a header/meta conflict toward the
 * restrictive directive, so its read stays interpretable; Bing and the AI crawlers publish no
 * such rule, and Bing Webmaster is on the citation path. The only state that survives a crawler
 * whose rules we cannot read is "both surfaces say the same thing for the same reason".
 *
 * This is the unit half — it proves the derivation, the way
 * `src/__tests__/scripts/noindex-routes.test.ts` does for the path set.
 * `src/__tests__/build/prerendered-robots.test.ts` proves the artefact, which is the only
 * thing a crawler reads. Both are needed: a route can be correct in this function and still
 * be emitted wrong, because the sitemap suites already record that shape.
 *
 * No `dist/` is involved, so this file lives outside `src/__tests__/build/` and needs no
 * `describeDist` gate.
 */

const ROOT = join(process.cwd());

/** The real rules, not a hand-written fixture — the same read `generate-sitemap.ts` performs. */
function shippedNoindexRoutes() {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf-8')) as {
    headers?: VercelHeaderRule[];
  };
  return noindexRoutes(vercel.headers ?? []);
}

/** The anchor as `index.html` actually writes it, read from the file rather than retyped. */
function shippedRobotsMeta(): string {
  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
  const found = /<meta\s+name="robots"[^>]*>/.exec(indexHtml);
  if (!found) {
    throw new Error(
      'index.html no longer carries a <meta name="robots"> tag. That is not a passing ' +
        'condition for this suite — it is the anchor applyRobotsMeta rewrites, and without ' +
        'it every page would silently keep whatever the SPA shell emits.'
    );
  }
  return found[0];
}

const page = (robots: string) => `<html lang="en"><head>${robots}</head><body>x</body></html>`;

describe('applyRobotsMeta', () => {
  const routes = shippedNoindexRoutes();

  /**
   * The control, and it comes first: every assertion below is vacuous against an empty set.
   * `noindex-routes.ts` already throws on a site-wide rule for the mirror-image reason.
   */
  it('derives a non-empty noindex set from the shipped vercel.json', () => {
    expect(routes.exact.size).toBeGreaterThan(0);
    expect(routes.matches('/results')).toBe(true);
    expect(routes.matches('/sample')).toBe(true);
  });

  it('marks a noindex base path noindex', () => {
    const out = applyRobotsMeta(page(shippedRobotsMeta()), '/results', routes);
    expect(out).toContain('name="robots"');
    expect(/<meta\s+name="robots"\s+content="([^"]*)"/.exec(out)?.[1]).toContain('noindex');
  });

  it('leaves an indexable base path indexable', () => {
    const out = applyRobotsMeta(page(shippedRobotsMeta()), '/upload', routes);
    expect(/<meta\s+name="robots"\s+content="([^"]*)"/.exec(out)?.[1]).not.toContain('noindex');
  });

  /**
   * The locale prefix is stripped by the caller, so this function only ever sees base paths.
   * Asserting it anyway states the contract at the boundary where it is easy to get wrong:
   * `/es/results` reaching here unstripped would be treated as indexable.
   */
  it('treats the base path as already locale-stripped', () => {
    const out = applyRobotsMeta(page(shippedRobotsMeta()), '/es/results', routes);
    expect(/<meta\s+name="robots"\s+content="([^"]*)"/.exec(out)?.[1]).not.toContain('noindex');
  });

  /**
   * Every other rewrite in `ssg-meta-injector.ts` is a bare `String.replace`, which returns the
   * input unchanged when the anchor is absent. For this one that failure mode IS GH#257: a
   * noindex page would keep advertising `index, follow` while the build stayed green. Throwing
   * is what makes a renamed anchor a build failure instead of a silent regression.
   */
  it('throws rather than silently doing nothing when the anchor is gone', () => {
    // Matched on `index.html`, not on /robots/i: the function's own name carries that word, so
    // `applyRobotsMeta is not a function` satisfies the loose pattern and the assertion passes
    // against no implementation at all. Caught here when this suite was first run red.
    expect(() => applyRobotsMeta('<html><head></head></html>', '/results', routes)).toThrow(
      /index\.html/
    );
  });
});
