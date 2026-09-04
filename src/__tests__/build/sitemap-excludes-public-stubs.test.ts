import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, it, expect } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * A file that public/ ships verbatim is not a page. It is an ownership or search-console
 * stub: no head, no copy, often an empty <title>. `scripts/generate-sitemap.ts` builds the
 * sitemap by scanning dist/, which holds those stubs alongside the prerendered pages, so
 * every one of them is a candidate <loc> unless something excludes it.
 *
 * The generator's exclusion list enumerated them and was one stub behind: it filtered
 * `google[a-z0-9]+.html` and not `fo-verify.html`, which shipped at priority 0.7 with
 * eleven hreflang alternates — nine of them locale-prefixed addresses no build emits. The
 * list was green on the stubs it named and silent on the next one added, so this suite
 * names none of them either: both sides are derived — public/ walked, and the sitemap's
 * own URLs parsed — and a stub added tomorrow is bound the day the file appears.
 *
 * `describe.runIf(built)` like the other prerender suites: dist/sitemap.xml is a postbuild
 * artefact, so a dist-less run SKIPS this file rather than failing it, and that skip is not
 * a pass. dist/ and public/ are resolved from this file's own repo root, because each
 * worktree has its own and a relative path reads whichever one the process started in.
 */
const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');
const publicDir = join(root, 'public');
const sitemapPath = join(dist, 'sitemap.xml');
const built = existsSync(dist) && existsSync(sitemapPath);

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

/** cleanUrls is on and trailingSlash is off (vercel.json), so public/x.html serves /x. */
function urlPathOf(rel: string): string {
  const withoutExt = rel.replace(/\.html$/, '');
  return withoutExt === 'index' ? '/' : `/${withoutExt}`;
}

/** The URL path with any locale prefix removed — the shape the generator emits alternates in. */
function basePathOf(urlPath: string): string {
  const first = urlPath.split('/')[1];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(first)
    ? urlPath.slice(`/${first}`.length) || '/'
    : urlPath;
}

/** Every address the sitemap advertises: the <loc> of each entry and its hreflang alternates. */
function advertisedPaths(xml: string): Array<{ url: string; basePath: string }> {
  const urls = [
    ...[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]),
    ...[...xml.matchAll(/<xhtml:link\b[^>]*\bhref="([^"]*)"/g)].map(m => m[1]),
  ];
  return urls.map(url => ({ url, basePath: basePathOf(new URL(url).pathname) }));
}

describe.runIf(built)('sitemap and the files public/ ships verbatim', () => {
  const xml = built ? readFileSync(sitemapPath, 'utf-8') : '';
  const advertised = advertisedPaths(xml);
  const stubPaths = existsSync(publicDir)
    ? walkHtml(publicDir).map(f => urlPathOf(toPosix(relative(publicDir, f))))
    : [];

  it('reads a sitemap with entries in it, and a public/ with stubs in it', () => {
    // Guards the guard, on both sides: an empty sitemap satisfies the assertion below,
    // and so does a public/ walk that found nothing to look for.
    expect(advertised.length).toBeGreaterThan(50);
    expect(stubPaths.length).toBeGreaterThan(0);
  });

  it('advertises no file that public/ ships verbatim', () => {
    const stubs = new Set(stubPaths);
    const offending = advertised
      .filter(entry => stubs.has(entry.basePath))
      .map(entry => `${entry.url} — public${entry.basePath}.html is shipped verbatim`);
    expect(offending).toEqual([]);
  });
});
