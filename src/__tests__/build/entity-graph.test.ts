import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { expect, it } from 'vitest';
import { describeDist } from '../utils/dist-gate';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../config/languages';
import { INTENT_PATHS } from '../../config/intent-pages';
import { shippedNoindexRoutes } from '../../../scripts/noindex-routes';

/**
 * The entity graph as a crawler reads it: in the prerendered HTML, not in a jsdom render.
 *
 * `OrganizationSchema.test.tsx` proves the component's placement per path. This proves the
 * artefact, which can disagree with the component for two reasons this repository has met
 * before: the pages are produced by a separate pass (vite-react-ssg), and a second emitter
 * (an injector, or a second mount) can add an identical block that no unit test renders. The
 * expected shape: exactly one `Organization` node on every indexable prerendered page, none on
 * a page `public/_headers` serves with `X-Robots-Tag: noindex`.
 *
 * "Indexable" is derived from `_headers` via `shippedNoindexRoutes`, the same reader the sitemap
 * generator and the robots-meta injector use, so the component's own restated path set
 * (`NO_ENTITY_PATHS`) is checked against the source of truth rather than against itself.
 *
 * `describeDist` like its neighbours: a dist-less local run SKIPS this, and that skip is not a
 * pass; under `EXPECT_DIST` it FAILS instead (GH#159).
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

/** Files `public/` ships verbatim are not prerendered pages; derived, not listed. */
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

function urlPathOf(rel: string): string {
  const withoutExt = rel.replace(/\.html$/, '');
  return withoutExt === 'index' ? '/' : `/${withoutExt}`;
}

function basePathOf(urlPath: string): string {
  const first = urlPath.split('/')[1];
  const isLocale =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(first) &&
    (first as SupportedLanguage) !== 'en';
  return isLocale ? urlPath.slice(`/${first}`.length) || '/' : urlPath;
}

const NOINDEX = shippedNoindexRoutes(root);

type Node = { '@type'?: string | string[] };

/** Every JSON-LD node on the page, top-level or inside a `@graph`. */
function nodesIn(html: string): Node[] {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1]) as Node & { '@graph'?: Node[] })
    .flatMap(block => block['@graph'] ?? [block]);
}

function countOf(rel: string, type: string): number {
  return nodesIn(readFileSync(join(dist, rel), 'utf8')).filter(n =>
    Array.isArray(n['@type']) ? n['@type'].includes(type) : n['@type'] === type
  ).length;
}

function pageFor(urlPath: string): string {
  return urlPath === '/' ? 'index.html' : `${urlPath.slice(1)}.html`;
}

describeDist('prerendered entity graph', built, () => {
  /** Controls: both sides of the noindex split exist, or half of each assertion is vacuous. */
  it('has pages on both sides of the noindex split', () => {
    const split = prerenderedPages().map(rel => NOINDEX.matches(basePathOf(urlPathOf(rel))));
    expect(split.filter(Boolean).length).toBeGreaterThan(0);
    expect(split.filter(hit => !hit).length).toBeGreaterThan(0);
  });

  it('every indexable prerendered page carries exactly one Organization node', () => {
    const wrong = prerenderedPages()
      .filter(rel => !NOINDEX.matches(basePathOf(urlPathOf(rel))))
      .map(rel => [rel, countOf(rel, 'Organization')] as const)
      .filter(([, n]) => n !== 1)
      .map(([rel, n]) => `${rel}: ${n} Organization nodes`);
    expect(wrong).toEqual([]);
  });

  it('/results and /sample prerendered pages carry no Organization node', () => {
    const noindexed = prerenderedPages().filter(rel => NOINDEX.matches(basePathOf(urlPathOf(rel))));
    // Every locale's results and sample page, not just the English pair.
    expect(noindexed.length).toBe(SUPPORTED_LANGUAGES.length * 2);
    const wrong = noindexed
      .map(rel => [rel, countOf(rel, 'Organization') + countOf(rel, 'Person')] as const)
      .filter(([, n]) => n !== 0)
      .map(([rel, n]) => `${rel}: ${n} entity nodes`);
    expect(wrong).toEqual([]);
  });

  it('/upload and the intent pages carry the Organization and Person nodes', () => {
    for (const path of ['/upload', ...INTENT_PATHS]) {
      expect(countOf(pageFor(path), 'Organization'), path).toBe(1);
      expect(countOf(pageFor(path), 'Person'), path).toBe(1);
      expect(countOf(pageFor(path), 'SoftwareApplication'), path).toBe(0);
    }
  });

  it('the home pages alone carry the WebSite and SoftwareApplication nodes', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const page = lang === 'en' ? 'index.html' : `${lang}.html`;
      expect(countOf(page, 'WebSite'), page).toBe(1);
      expect(countOf(page, 'SoftwareApplication'), page).toBe(1);
    }
  });
});
