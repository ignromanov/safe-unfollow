import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { docsPaths } from '../../../scripts/docs-paths';
import { describeDist } from '../utils/dist-gate';

/**
 * `sitemap.xml` is the only thing that tells a crawler a `/docs/*` page exists, and until GH#187
 * nothing asserted that it lists any of them. The docs are built separately (`vercel.json`:
 * `npm run build && cd docs && jekyll build`), so the generator cannot discover them by scanning
 * `dist/` and has to add them from a list — which is now derived from the sources rather than
 * typed out. This is the artefact-level half: that the derived list actually reaches the file.
 *
 * Why both this and `docs-paths.test.ts`: that suite proves the derivation is right, and it would
 * still pass if someone deleted the loop in `generate-sitemap.ts` that emits these entries. Only
 * the generated file proves both halves ran.
 *
 * The comparison is an equality, not a subset, so it fails in both directions — a page missing
 * from the sitemap, and a `/docs/*` URL in the sitemap that no source declares (a deleted page
 * left behind advertises a 404 to every crawler that reads it).
 *
 * `describeDist` like the other sitemap suites: this needs a `dist/`, which only `ci.yml`
 * produces before the tests. A dist-less local run skips, and that skip is not a pass; under
 * `EXPECT_DIST` it fails instead (GH#159).
 */
const BASE_URL = 'https://safeunfollow.app';

const dist = resolve(__dirname, '../../../dist');
const sitemapPath = join(dist, 'sitemap.xml');
const built = existsSync(dist) && existsSync(sitemapPath);

describeDist('the sitemap lists every docs page the sources declare', built, () => {
  const xml = built ? readFileSync(sitemapPath, 'utf-8') : '';
  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]!);
  const declared = docsPaths(resolve(__dirname, '../../../docs')).map(path => `${BASE_URL}${path}`);

  it('reads a sitemap with entries in it', () => {
    // Guards the guard: against an empty sitemap the equality below would hold only if the docs
    // tree were also empty, and both readings of "no entries" would pass as agreement.
    expect(locations.length).toBeGreaterThan(50);
  });

  it('reads a docs tree with pages in it', () => {
    expect(declared.length).toBeGreaterThan(10);
  });

  it('lists exactly the docs URLs the sources declare, in neither direction more', () => {
    const listed = locations.filter(location => location.startsWith(`${BASE_URL}/docs`));
    expect([...listed].sort()).toEqual([...declared].sort());
  });
});
