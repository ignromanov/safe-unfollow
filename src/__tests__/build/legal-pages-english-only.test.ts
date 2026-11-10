import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '../../config/languages';
import { describeDist } from '../utils/dist-gate';

/**
 * The legal pages exist once, in English (plan 2026-11-09 task 08a, ruling R5; velum-cdpo Q3).
 *
 * `PrivacyPolicy.tsx` and `TermsOfService.tsx` are hard-coded English with no `t()`, so
 * `/es/privacy` under an `es` hreflang told engines a Spanish policy exists when it does not.
 * The routes are gone and `public/_redirects` sends every locale variant to the English page;
 * this proves the artefact agrees: no prerendered locale copy, no sitemap entry, and no hreflang
 * cluster naming the nine addresses that now redirect.
 */
const dist = resolve(__dirname, '../../../dist');
const sitemapPath = join(dist, 'sitemap.xml');
const built = existsSync(join(dist, 'index.html')) && existsSync(sitemapPath);

const LOCALIZED = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');
const PAGES = ['privacy', 'terms'];

describeDist('legal pages are English-only in the build', built, () => {
  it('dist has no /xx/privacy or /xx/terms page and the sitemap lists neither', () => {
    // Control: the English pages are there, so an empty dist cannot pass this.
    for (const page of PAGES) expect(existsSync(join(dist, `${page}.html`)), page).toBe(true);

    const prerendered = LOCALIZED.flatMap(lang => PAGES.map(page => `${lang}/${page}.html`)).filter(
      rel => existsSync(join(dist, rel))
    );
    expect(prerendered).toEqual([]);

    const sitemap = readFileSync(sitemapPath, 'utf-8');
    const listed = [
      ...sitemap.matchAll(/https:\/\/safeunfollow\.app\/([a-z]{2})\/(privacy|terms)\b/g),
    ].map(m => m[0]);
    expect(listed).toEqual([]);
    for (const page of PAGES) {
      expect(sitemap).toContain(`<loc>https://safeunfollow.app/${page}</loc>`);
    }
  });

  it('/privacy and /terms carry no hreflang', () => {
    for (const page of PAGES) {
      const html = readFileSync(join(dist, `${page}.html`), 'utf-8');
      expect(html, `${page}.html`).not.toMatch(/hreflang=/);
      expect(html, `${page}.html`).not.toMatch(/property="og:locale:alternate"/);
      expect(html).toContain(`<link rel="canonical" href="https://safeunfollow.app/${page}"`);
    }
    // Control: a page that does exist in every locale still carries the cluster.
    expect(readFileSync(join(dist, 'upload.html'), 'utf-8')).toMatch(/hreflang="es"/);
  });
});
