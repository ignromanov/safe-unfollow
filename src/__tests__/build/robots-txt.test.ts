import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '../../config/languages';
import { INTENT_PATHS } from '../../config/intent-pages';
import { describeDist } from '../utils/dist-gate';

/**
 * robots.txt: `/results` and `/sample` are disallowed in every locale, and nothing else is.
 *
 * Operator ruling R3 (plan 2026-11-09-seo-aeo-geo, task 08d). Both routes already answer
 * `X-Robots-Tag: noindex`; the Disallow stops the crawl that spends budget on them. Known
 * residue, accepted: a page Google already holds may stay "indexed, though blocked", because a
 * blocked page's noindex is never re-read.
 *
 * The risk is over-match, so the check reads the file the way Google does — the longest
 * matching rule wins, `Allow` wins a tie, `*` matches any run of characters and `$` anchors the
 * end — and then asserts that every URL the sitemap advertises is still allowed. That set is
 * derived, so a new page is covered by existing.
 *
 * There used to be two sources: `public/robots.txt`, copied into `dist/` by Vite, and
 * `generateRobotsTxt()` in the sitemap generator, which overwrote the copy. `public/robots.txt`
 * is now the only one.
 */
const root = resolve(__dirname, '../../..');
const distRobots = join(root, 'dist', 'robots.txt');
const sitemapPath = join(root, 'dist', 'sitemap.xml');
const built = existsSync(distRobots) && existsSync(sitemapPath);

type Rule = { allow: boolean; pattern: string };

/** The rule group for `User-agent: *`. */
function rulesFor(text: string): Rule[] {
  const rules: Rule[] = [];
  let inStar = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (/^user-agent$/i.test(key!)) inStar = value === '*';
    else if (inStar && /^(allow|disallow)$/i.test(key!) && value !== '')
      rules.push({ allow: /^allow$/i.test(key!), pattern: value! });
  }
  return rules;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

/** Google's precedence: the most specific (longest) matching rule; Allow wins a tie. */
function allowed(rules: Rule[], path: string): boolean {
  const hits = rules.filter(r => matches(r.pattern, path));
  if (hits.length === 0) return true;
  hits.sort((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return hits[0]!.allow;
}

const localized = (base: string) =>
  SUPPORTED_LANGUAGES.map(l => (l === 'en' ? base : `/${l}${base}`));

describe('robots.txt has one source', () => {
  it('the sitemap generator writes no robots.txt of its own', () => {
    const source = readFileSync(join(root, 'scripts', 'generate-sitemap.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(source).not.toMatch(/robots\.txt/);
    expect(source).toMatch(/sitemap\.xml/); // control: the strip left the code
  });

  it('the matcher can go red: a bare /*/sample also blocks a docs page named sample', () => {
    const naive = [{ allow: false, pattern: '/*sample' }];
    expect(allowed(naive, '/docs/sample-data')).toBe(false);
    expect(allowed([{ allow: false, pattern: '/*/sample' }], '/es/upload')).toBe(true);
  });
});

describeDist('dist robots.txt', built, () => {
  const rules = built ? rulesFor(readFileSync(distRobots, 'utf-8')) : [];

  it('dist robots.txt disallows results and sample in every locale and nothing else', () => {
    for (const path of [...localized('/results'), ...localized('/sample')]) {
      expect(allowed(rules, path), `${path} is crawlable`).toBe(false);
    }
    const mustStayOpen = [
      '/',
      ...localized('/upload'),
      ...localized(''),
      '/docs',
      '/docs/instagram-export',
      '/privacy',
      '/terms',
      ...INTENT_PATHS,
    ].filter(p => p !== '');
    for (const path of mustStayOpen) {
      expect(allowed(rules, path), `${path} is blocked`).toBe(true);
    }
  });

  it('every URL the sitemap advertises is crawlable', () => {
    const locs = [
      ...readFileSync(sitemapPath, 'utf-8').matchAll(
        /<loc>https:\/\/safeunfollow\.app([^<]*)<\/loc>/g
      ),
    ].map(m => m[1] || '/');
    expect(locs.length).toBeGreaterThan(50);
    expect(locs.filter(path => !allowed(rules, path))).toEqual([]);
  });

  it('names no bot and keeps the sitemap line', () => {
    const text = readFileSync(distRobots, 'utf-8');
    expect([...text.matchAll(/^user-agent:\s*(.*)$/gim)].map(m => m[1]!.trim())).toEqual(['*']);
    expect(text).toMatch(/^Sitemap: https:\/\/safeunfollow\.app\/sitemap\.xml$/m);
  });
});
