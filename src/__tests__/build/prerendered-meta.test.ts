import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, it, expect } from 'vitest';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../config/languages';

/**
 * vite/ssg-meta-injector.ts is the only thing that turns src/locales/<lang>/meta.json into
 * shipped HTML, and until this suite existed nothing read its output: two build suites
 * import helper functions from that module, none asserted a <title>, a description or a
 * <link rel="canonical"> in any dist page.
 *
 * The shape that would have shipped silently is the one this branch removed by hand —
 * eight /wizard/step/N pages per language all canonicalized back to /wizard. A regression
 * pointing ten /upload pages at the site root is the same bug, passes code:check, passes
 * the full suite, and is invisible in the rendered page.
 *
 * Runs only against a dist/ that exists: describe.runIf(built) means a dist-less run
 * SKIPS this file rather than failing it, so a green run proves nothing unless something
 * built first. dist/ is resolved from this file's own repo root, because each worktree
 * has its own and a relative path reads whichever one the process happens to start in.
 */

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/** Every .html under a directory, recursively, as absolute paths. */
function walkHtml(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkHtml(full);
    return full.endsWith('.html') ? [full] : [];
  });
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * The origin the canonical URLs are built from, read out of the module that decides it
 * rather than restated here. A rename throws instead of quietly asserting nothing.
 */
function siteOrigin(): string {
  const source = readFileSync(join(root, 'vite', 'ssg-meta-injector.ts'), 'utf8');
  const declared = /const BASE_URL = '([^']+)'/.exec(source);
  if (!declared) throw new Error('ssg-meta-injector.ts no longer declares BASE_URL as a literal');
  return declared[1];
}

/**
 * Files under public/ are copied into dist verbatim — search-console and domain
 * verification stubs that carry no head at all. Derived by walking public/, so adding
 * another one does not need an edit here.
 */
function copiedFromPublic(): Set<string> {
  const publicDir = join(root, 'public');
  if (!existsSync(publicDir)) return new Set();
  return new Set(walkHtml(publicDir).map(f => toPosix(relative(publicDir, f))));
}

/**
 * Every prerendered page: walked, never enumerated. dist/docs is Jekyll's output, built
 * by a separate command that this injector never touches.
 */
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

function localeOf(urlPath: string): SupportedLanguage {
  const first = urlPath.split('/')[1];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(first)
    ? (first as SupportedLanguage)
    : 'en';
}

/** The page's path with its language prefix removed — the key meta.json routes are keyed by. */
function basePathOf(urlPath: string, lang: SupportedLanguage): string {
  if (lang === 'en') return urlPath;
  return urlPath.slice(`/${lang}`.length) || '/';
}

interface MetaSlots {
  title: string;
  description: string;
  ogTitle?: string;
}

interface MetaFile extends MetaSlots {
  routes?: Record<string, Partial<MetaSlots>>;
}

const metaCache = new Map<string, MetaFile>();

function metaFor(lang: SupportedLanguage): MetaFile {
  const cached = metaCache.get(lang);
  if (cached) return cached;
  const parsed = JSON.parse(
    readFileSync(join(root, 'src', 'locales', lang, 'meta.json'), 'utf8')
  ) as MetaFile;
  metaCache.set(lang, parsed);
  return parsed;
}

/**
 * What meta.json says this page should carry, and whether the page has an entry of its
 * own. Pages with no entry — the /404 set, which the injector serves from its own
 * NOT_FOUND_META constant — return null and are only checked for being non-empty.
 */
function expectedMeta(
  urlPath: string
): { slots: MetaSlots; fallback: MetaSlots; ownEntry: boolean } | null {
  const lang = localeOf(urlPath);
  const file = metaFor(lang);
  const fallback: MetaSlots = {
    title: file.title,
    description: file.description,
    ogTitle: file.ogTitle ?? file.title,
  };
  const base = basePathOf(urlPath, lang);
  const route = file.routes?.[base];
  if (route) {
    return {
      slots: {
        title: route.title ?? fallback.title,
        description: route.description ?? fallback.description,
        ogTitle: route.ogTitle ?? route.title ?? fallback.ogTitle,
      },
      fallback,
      ownEntry: true,
    };
  }
  if (base === '/') return { slots: fallback, fallback, ownEntry: false };
  return null;
}

/** The four entities the injector escapes, read back the way a browser reads them. */
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attributeContent(html: string, pattern: RegExp): string | null {
  const tag = pattern.exec(html);
  return tag ? decodeEntities(tag[1]) : null;
}

function readPage(rel: string): string {
  return readFileSync(join(dist, rel), 'utf8');
}

describe.runIf(built)('prerendered meta', () => {
  it('walks the whole prerendered tree, every language included', () => {
    const pages = prerenderedPages();
    // A floor, not a count: a non-recursive walk would see only the top level.
    expect(
      pages.length,
      'too few prerendered pages — is the walk still recursive?'
    ).toBeGreaterThan(50);
    const seen = new Set(pages.map(rel => localeOf(urlPathOf(rel))));
    expect([...SUPPORTED_LANGUAGES].filter(lang => !seen.has(lang))).toEqual([]);
  });

  it('every page is self-canonical', () => {
    const origin = siteOrigin();
    const wrong: string[] = [];
    for (const rel of prerenderedPages()) {
      const html = readPage(rel);
      const tags = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/g) ?? [];
      if (tags.length !== 1) {
        wrong.push(`${rel}: ${tags.length} canonical tags`);
        continue;
      }
      const href = attributeContent(tags[0], /href="([^"]*)"/);
      const expected = `${origin}${urlPathOf(rel)}`;
      if (href !== expected) wrong.push(`${rel}: canonical ${href} — expected ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  it('every page carries a non-empty title and description', () => {
    const empty: string[] = [];
    for (const rel of prerenderedPages()) {
      const html = readPage(rel);
      const title = attributeContent(html, /<title>([^<]*)<\/title>/);
      const description = attributeContent(html, /<meta\s+name="description"\s+content="([^"]*)"/);
      if (!title?.trim()) empty.push(`${rel}: title is ${title === null ? 'absent' : 'empty'}`);
      if (!description?.trim()) {
        empty.push(`${rel}: description is ${description === null ? 'absent' : 'empty'}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('serves each page its own meta.json entry, never the site-wide fallback', () => {
    const wrong: string[] = [];
    for (const rel of prerenderedPages()) {
      const expected = expectedMeta(urlPathOf(rel));
      if (!expected) continue;
      const html = readPage(rel);
      const actual: MetaSlots = {
        title: attributeContent(html, /<title>([^<]*)<\/title>/) ?? '',
        description: attributeContent(html, /<meta\s+name="description"\s+content="([^"]*)"/) ?? '',
        ogTitle: attributeContent(html, /<meta\s+property="og:title"\s+content="([^"]*)"/) ?? '',
      };
      for (const slot of ['title', 'description', 'ogTitle'] as const) {
        if (actual[slot] !== expected.slots[slot]) {
          wrong.push(`${rel}: ${slot} is "${actual[slot]}" — expected "${expected.slots[slot]}"`);
        }
        // The docs/compare failure: front matter that does not parse leaves the page
        // rendering the site-wide default, which is well-formed and looks fine.
        if (expected.ownEntry && actual[slot] === expected.fallback[slot]) {
          wrong.push(`${rel}: ${slot} fell back to the site-wide default`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
