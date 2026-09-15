import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { expect, it } from 'vitest';
import { describeDist } from '../utils/dist-gate';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../config/languages';
import { noindexRoutes, type VercelHeaderRule } from '../../../scripts/noindex-routes';

/**
 * Every prerendered page shipped `<meta name="robots" content="index, follow" />`, inherited
 * from `index.html`, including the twenty paths `vercel.json` serves with
 * `X-Robots-Tag: noindex` (GH#257). Measured on production 2026-09-15: `/results` returned the
 * header and the opposite directive in the body, simultaneously.
 *
 * Nothing looked. `grep -rn robots src/__tests__/build/*.ts` returned zero before this file;
 * `prerendered-meta.test.ts` asserts titles, descriptions and canonicals and says nothing about
 * robots. That is why it shipped and why it would come back.
 *
 * `src/__tests__/vite/ssg-robots-meta.test.ts` is the unit half and proves the derivation. This
 * proves the artefact, which is the only thing a crawler reads — the same two-gate split
 * `sitemap-omits-noindexed.test.ts` records, for the same reason: a route can be right in the
 * function and still be emitted wrong, because the pages are produced by a separate pass.
 *
 * `describeDist` like its neighbours: a dist-less local run SKIPS this, and that skip is not a
 * pass; under `EXPECT_DIST` (set only by `ci.yml`) it FAILS instead (GH#159). `dist/` is
 * resolved from this file's own repo root, because each worktree has its own.
 */

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

function walkHtml(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkHtml(full);
    return full.endsWith('.html') ? [full] : [];
  });
}

const toPosix = (p: string) => p.split(sep).join('/');

/**
 * The verification stubs and other files `public/` ships verbatim are not prerendered pages —
 * they never pass through `injectLocalizedMeta` and carry no robots meta of ours. Derived by
 * asking what `public/` holds, the way `prerendered-meta.test.ts` does, rather than by naming
 * files here: a hand-written exclusion list is what `generate-sitemap.ts` records as having been
 * "one stub behind reality".
 */
function copiedFromPublic(): Set<string> {
  const publicDir = join(root, 'public');
  if (!existsSync(publicDir)) return new Set();
  return new Set(walkHtml(publicDir).map(f => toPosix(relative(publicDir, f))));
}

function prerenderedPages(): string[] {
  const copied = copiedFromPublic();
  return walkHtml(dist)
    .map(f => toPosix(relative(dist, f)))
    .filter(rel => !rel.startsWith('docs/') && !copied.has(rel))
    .sort();
}

/** cleanUrls is on and trailingSlash is off (vercel.json), so es/upload.html serves /es/upload. */
function urlPathOf(rel: string): string {
  const withoutExt = rel.replace(/\.html$/, '');
  return withoutExt === 'index' ? '/' : `/${withoutExt}`;
}

/** The page's path with its language prefix removed — the key `noindexRoutes` matches on. */
function basePathOf(urlPath: string): string {
  const first = urlPath.split('/')[1];
  const isLocale =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(first) &&
    (first as SupportedLanguage) !== 'en';
  return isLocale ? urlPath.slice(`/${first}`.length) || '/' : urlPath;
}

/** Read from `vercel.json` the same way the generator and the injector do, not hand-listed. */
const VERCEL = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf-8')) as {
  headers?: VercelHeaderRule[];
};
const NOINDEX = noindexRoutes(VERCEL.headers ?? []);

function robotsContentOf(html: string): string | undefined {
  return /<meta\s+name="robots"\s+content="([^"]*)"/.exec(html)?.[1];
}

describeDist('prerendered robots meta', built, () => {
  /**
   * Three controls, and they run first because every assertion below is vacuous without them.
   * The third is the one that matters: if the build emitted only indexable pages, or only
   * noindex ones, half the real assertion would pass by having nothing to judge — which is
   * exactly how "14/14 noindex" read as coverage while the set held 20.
   */
  it('has pages, a noindex set, and at least one page on each side of it', () => {
    const pages = prerenderedPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(NOINDEX.exact.size).toBeGreaterThan(0);

    const split = pages.map(rel => NOINDEX.matches(basePathOf(urlPathOf(rel))));
    expect(split.filter(Boolean).length).toBeGreaterThan(0);
    expect(split.filter(hit => !hit).length).toBeGreaterThan(0);
  });

  it('marks every page the header noindexes, and no other page', () => {
    const wrong = prerenderedPages().flatMap(rel => {
      const content = robotsContentOf(readFileSync(join(dist, rel), 'utf8'));
      if (content === undefined) return [`${rel}: no <meta name="robots"> at all`];

      const shouldBeNoindex = NOINDEX.matches(basePathOf(urlPathOf(rel)));
      const isNoindex = /\bnoindex\b/.test(content);
      if (shouldBeNoindex === isNoindex) return [];
      return [
        `${rel}: X-Robots-Tag says ${shouldBeNoindex ? 'noindex' : 'index'}, ` +
          `page says "${content}"`,
      ];
    });

    expect(wrong).toEqual([]);
  });
});
