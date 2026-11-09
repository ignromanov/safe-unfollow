import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { docsLastUpdated } from '../../../scripts/docs-paths';
import { citationReleaseDate } from '../../../vite/build-env';
import { describeDist } from '../utils/dist-gate';

/**
 * `<lastmod>` comes from content, never from the build clock.
 *
 * Until v1.7.0 every entry carried `new Date()` — the day the build ran — so each deploy told
 * crawlers that every page on the site had changed that day, the docs pages included. A lastmod
 * that is always today is one a crawler learns to ignore, which costs the one page that really did
 * change. Now: a docs page takes its front-matter `last_updated`; every app route takes
 * `CITATION.cff`'s `date-released`, the date its content last shipped.
 */
const root = resolve(__dirname, '../../..');
const BASE_URL = 'https://safeunfollow.app';
const sitemapPath = join(root, 'dist', 'sitemap.xml');
const built = existsSync(sitemapPath);

const RELEASE_DATE = citationReleaseDate(readFileSync(join(root, 'CITATION.cff'), 'utf-8'));
const DOCS_DATES = docsLastUpdated(join(root, 'docs'));

function entries(): Array<{ loc: string; lastmod: string }> {
  const xml = readFileSync(sitemapPath, 'utf-8');
  return [
    ...xml.matchAll(/<url>[\s\S]*?<loc>([^<]*)<\/loc>[\s\S]*?<lastmod>([^<]*)<\/lastmod>/g),
  ].map(m => ({ loc: m[1]!, lastmod: m[2]! }));
}

describe('the sitemap generator reads no clock', () => {
  it('two builds of one commit write an identical sitemap', () => {
    // The only time-varying input the generator ever had was `new Date()`. With comments
    // stripped, so a docblock explaining the old defect cannot satisfy or trip the check.
    const source = readFileSync(join(root, 'scripts', 'generate-sitemap.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(source).not.toMatch(/new Date\(|Date\.now\(|performance\.now\(/);
    // Control: the strip leaves code, or the check above is vacuous.
    expect(source).toMatch(/lastmod/);
  });
});

describeDist('sitemap lastmod is derived from content', built, () => {
  it('docs URLs take lastmod from front-matter last_updated', () => {
    const docs = entries().filter(e => e.loc.startsWith(`${BASE_URL}/docs`));
    expect(docs.length).toBe(DOCS_DATES.size);
    for (const e of docs) {
      expect(e.lastmod, e.loc).toBe(DOCS_DATES.get(e.loc.slice(BASE_URL.length)));
    }
  });

  it('no lastmod equals the build date unless that content changed that day', () => {
    const all = entries();
    expect(all.length).toBeGreaterThan(50);
    for (const e of all.filter(x => !x.loc.startsWith(`${BASE_URL}/docs`))) {
      expect(e.lastmod, e.loc).toBe(RELEASE_DATE);
    }
  });
});
