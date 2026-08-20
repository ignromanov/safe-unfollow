import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import { dropOnDemandFontPreloads } from '../../../vite/ssg-meta-injector';

/**
 * Three things have to line up before a single glyph of a self-hosted font renders, and
 * this site had all three wrong at once from 8d907a2 (Sep 2025) until 2026-08-20:
 *
 *   1. the family name in the stack must be byte-identical to the @font-face family —
 *      CSS family matching is exact, so 'Inter' never matched 'Inter Variable' and the
 *      browser fell silently through to the system stack;
 *   2. the url() in that @font-face must resolve to a file that exists — Tailwind v4's
 *      PostCSS @import resolver inlines the package CSS WITHOUT rebasing relative urls,
 *      so `./files/…` survived into /assets/app-*.css and pointed at /assets/files/,
 *      a directory that has never existed;
 *   3. a preloaded font must be the same URL the stylesheet asks for, or it is dead
 *      weight on the LCP path — and index.html IS rewritten by Vite while the CSS is
 *      not, so the two named different URLs for identical bytes.
 *
 * Each check below fails on exactly one of those. Nothing else in the suite noticed,
 * because every one of them degrades to "renders in SF Pro / Roboto" rather than erroring.
 */

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');

/** Strip comments and collapse whitespace so multi-line declarations parse as one. */
function flatten(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
}

/** Every family declared by an @font-face rule in the given CSS. */
function declaredFamilies(css: string): Set<string> {
  const out = new Set<string>();
  for (const rule of flatten(css).matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family:\s*(?:'([^']*)'|"([^"]*)"|([^;]+?))\s*[;}]/.exec(`${rule[1]};`);
    if (family) out.add((family[1] ?? family[2] ?? family[3]).trim());
  }
  return out;
}

/** The declared value of a custom property or a declaration inside a named rule. */
function declaration(css: string, prop: string): string {
  const m = new RegExp(`${prop}:\\s*([^;]+);`).exec(flatten(css));
  if (!m) throw new Error(`no ${prop} declaration found`);
  return m[1].trim();
}

/** Quoted family names at the head of a stack, i.e. the ones that must be self-hosted. */
function quotedFamilies(stack: string): string[] {
  return [...stack.matchAll(/'([^']+)'|"([^"]+)"/g)].map(m => (m[1] ?? m[2]).trim());
}

const stylesCss = readFileSync(join(root, 'src/styles.css'), 'utf8');
const mainTsx = readFileSync(join(root, 'src/main.tsx'), 'utf8');

/**
 * Whichever file pulls the packages in — a CSS @import or a JS import — the set of
 * bundled @font-face families is the union of the packages named in either. Derived
 * rather than hardcoded so moving the import between the two does not silently
 * empty this set and turn the assertions below into vacuous truths.
 */
function bundledFontPackages(): string[] {
  const named = new Set<string>();
  for (const src of [stylesCss, mainTsx]) {
    for (const m of src.matchAll(/@fontsource(?:-variable)?\/[a-z0-9-]+/g)) named.add(m[0]);
  }
  return [...named];
}

function bundledFamilies(): Set<string> {
  const packages = bundledFontPackages();
  expect(packages.length, 'no @fontsource package is imported anywhere').toBeGreaterThan(0);
  const out = new Set<string>();
  for (const pkg of packages) {
    const css = readFileSync(join(root, 'node_modules', pkg, 'index.css'), 'utf8');
    for (const family of declaredFamilies(css)) out.add(family);
  }
  return out;
}

describe('font stacks name the families that are actually shipped', () => {
  it('--font-sans leads with a self-hosted family', () => {
    const wanted = quotedFamilies(declaration(stylesCss, '--font-sans'))[0];
    expect([...bundledFamilies()]).toContain(wanted);
  });

  it('.font-display leads with a self-hosted family', () => {
    // Three rules carry this selector — two set letter-spacing (one of them RTL-only).
    // Take the one that actually declares a family, not merely the first match.
    const body = [...flatten(stylesCss).matchAll(/\.font-display\s*\{([^}]*)\}/g)]
      .map(m => m[1])
      .find(b => b.includes('font-family:'));
    expect(body, 'no .font-display rule declares a font-family').toBeDefined();
    const wanted = quotedFamilies(declaration(`${body};`, 'font-family'))[0];
    expect([...bundledFamilies()]).toContain(wanted);
  });

  it('every bundled family is asked for by some stack — nothing downloads unused', () => {
    const asked = new Set(quotedFamilies(flatten(stylesCss)));
    for (const family of bundledFamilies()) expect([...asked]).toContain(family);
  });
});

/**
 * vite-react-ssg walks the entry's asset graph and emits a preload for every woff2 it
 * finds (vite-react-ssg.Ctg3mDmH.mjs:218). While the fonts were unreachable there was
 * nothing to find; making them reachable put all ten subsets — 269.5 KB against the two
 * latin ones' 73.8 KB — on the critical path of all 162 prerendered pages. Preloading a
 * unicode-range subset defeats the mechanism: the browser fetches those on demand, from
 * the characters actually on the page.
 */
describe('dropOnDemandFontPreloads', () => {
  const latin = '<link rel="preload" href="/assets/inter-latin-wght-normal-Dx4k.woff2" as="font">';
  const cyrillic =
    '<link rel="preload" as="font" type="font/woff2" href="/assets/inter-cyrillic-wght-normal-DqGu.woff2" crossorigin>';
  const latinExt =
    '<link rel="preload" as="font" type="font/woff2" href="/assets/inter-latin-ext-wght-normal-DO1A.woff2" crossorigin>';
  const script = '<link rel="modulepreload" crossorigin href="/assets/common-DIx3.js">';

  it('keeps the latin subset index.html deliberately puts on the critical path', () => {
    expect(dropOnDemandFontPreloads(latin)).toBe(latin);
  });

  it('drops a subset unicode-range would fetch on demand', () => {
    expect(dropOnDemandFontPreloads(cyrillic).trim()).toBe('');
  });

  it('drops latin-ext, which only Turkish reaches and swap covers', () => {
    expect(dropOnDemandFontPreloads(latinExt).trim()).toBe('');
  });

  it('leaves preloads that are not fonts alone', () => {
    expect(dropOnDemandFontPreloads(script)).toBe(script);
  });

  it('drops every non-latin subset from a realistic head, keeping the latin one', () => {
    const head = [latin, cyrillic, latinExt, script].join('\n    ');
    const out = dropOnDemandFontPreloads(head);
    expect(out).toContain('inter-latin-wght-normal');
    expect(out).toContain('common-DIx3.js');
    expect(out).not.toContain('cyrillic');
    expect(out).not.toContain('latin-ext');
  });
});

const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/** Walked lazily: describe.runIf still runs the suite body during collection. */
function builtCss(): { href: string; text: string }[] {
  const dir = join(dist, 'assets');
  return readdirSync(dir)
    .filter(f => f.endsWith('.css'))
    .map(f => ({ href: `/assets/${f}`, text: readFileSync(join(dir, f), 'utf8') }));
}

/** Absolute site paths of every font the built stylesheets request. */
function requestedFontUrls(): string[] {
  const out: string[] = [];
  for (const { href, text } of builtCss()) {
    for (const m of flatten(text).matchAll(/url\(\s*['"]?([^'")]+\.woff2?)['"]?\s*\)/g)) {
      const url = m[1];
      out.push(
        url.startsWith('/') ? url : new URL(url, `https://x${href}`).pathname // resolve ./files/… against the CSS
      );
    }
  }
  return out;
}

describe.runIf(built)('built font assets resolve', () => {
  it('every font the stylesheet requests exists in dist', () => {
    const requested = requestedFontUrls();
    expect(requested.length, 'built CSS requests no fonts at all').toBeGreaterThan(0);
    const missing = requested.filter(u => !existsSync(join(dist, u.replace(/^\//, ''))));
    expect(missing).toEqual([]);
  });

  it('every preloaded font is one the stylesheet requests', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const preloaded = [...html.matchAll(/<link[^>]+rel="preload"[^>]*>/g)]
      .filter(tag => tag[0].includes('as="font"'))
      .map(tag => /href="([^"]+)"/.exec(tag[0])?.[1] ?? '');
    expect(preloaded.length, 'no font is preloaded').toBeGreaterThan(0);
    const requested = requestedFontUrls();
    for (const href of preloaded) expect(requested).toContain(href);
  });
});
