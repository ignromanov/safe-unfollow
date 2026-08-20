import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

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

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

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

  /**
   * The locale-JSON check above is necessary but not sufficient: `→` also lived in
   * hardcoded strings in src/core/types/errors.ts, the parsers, FAQSection, the Terms
   * page and NotFoundPage — none of which that check can see. This one reads the text
   * a reader actually receives, so it does not care where the string was authored.
   */
  it('no prerendered page renders a character the body font cannot carry', () => {
    const pkg = bundledFontPackages().find(p => p.includes('inter'));
    const ranges = shippedRanges(pkg!);
    const pages = readdirSync(dist, { recursive: true } as never) as unknown as string[];
    const html = pages.filter(f => typeof f === 'string' && f.endsWith('.html'));
    expect(html.length, 'no prerendered pages to scan').toBeGreaterThan(0);

    const orphans = new Map<number, string>();
    for (const page of html) {
      const text = readFileSync(join(dist, page), 'utf8')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;|&#\d+;/g, ' ');
      for (const ch of text.replace(/\s/g, '')) {
        const cp = ch.codePointAt(0)!;
        if (orphans.has(cp)) continue;
        if (inRanges(cp, ranges)) continue;
        if (DELEGATED.some(d => cp >= d.from && cp <= d.to)) continue;
        orphans.set(cp, page);
      }
    }
    expect(
      [...orphans].map(
        ([cp, page]) =>
          `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)} (${page})`
      )
    ).toEqual([]);
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

/**
 * A character the shipped fonts do not carry is not an error — the browser silently
 * borrows it from the system font, mid-sentence, at a slightly different weight and
 * baseline. While no webfont loaded that was invisible, because every character came
 * from the same system font. It stops being invisible the moment one does.
 *
 * `→` (U+2192) is how this was found: absent from both families' files AND from every
 * shipped unicode-range, and present 264 times in the export instructions — 31 on every
 * home page. `↑`, `↓` and `›` are all present, so the gap is specific, not a subsetting
 * policy. Anything a family genuinely cannot carry belongs in DELEGATED with a reason.
 */
const DELEGATED: { name: string; from: number; to: number }[] = [
  { name: 'Arabic — no Arabic subset exists in either family', from: 0x0600, to: 0x06ff },
  { name: 'Kana and CJK — no CJK subset exists in either family', from: 0x3000, to: 0x30ff },
  { name: 'CJK ideographs', from: 0x4e00, to: 0x9fff },
  { name: 'Halfwidth/fullwidth forms', from: 0xff00, to: 0xffef },
  { name: 'emoji and dingbats — always font-fallback, by design', from: 0x2600, to: 0x27bf },
  { name: 'emoji presentation selector', from: 0xfe0f, to: 0xfe0f },
  { name: 'emoji planes', from: 0x1f300, to: 0x1faff },
];

function shippedRanges(pkg: string): string[] {
  const raw = readFileSync(join(root, 'node_modules', pkg, 'unicode.json'), 'utf8');
  return Object.values(JSON.parse(raw) as Record<string, string>).flatMap(r => r.split(','));
}

function inRanges(cp: number, parts: string[]): boolean {
  for (const part of parts) {
    const p = part.trim().replace('U+', '');
    if (p.includes('-')) {
      const [a, b] = p.split('-');
      if (parseInt(a, 16) <= cp && cp <= parseInt(b, 16)) return true;
    } else if (p.includes('?')) {
      const a = parseInt(p.replace(/\?/g, '0'), 16);
      const b = parseInt(p.replace(/\?/g, 'F'), 16);
      if (a <= cp && cp <= b) return true;
    } else if (parseInt(p, 16) === cp) return true;
  }
  return false;
}

describe('every character in shipped copy has a glyph in the font that renders it', () => {
  it('no locale string reaches for a character the body font cannot carry', () => {
    const inter = bundledFontPackages().find(p => p.includes('inter'));
    expect(inter, 'the body font package is not imported anywhere').toBeDefined();
    const ranges = shippedRanges(inter!);

    const used = new Map<number, string>();
    for (const file of readdirSync(join(root, 'src/locales'), { withFileTypes: true })) {
      if (!file.isDirectory()) continue;
      for (const ns of readdirSync(join(root, 'src/locales', file.name))) {
        const text = readFileSync(join(root, 'src/locales', file.name, ns), 'utf8');
        for (const ch of text.replace(/\s/g, '')) {
          const cp = ch.codePointAt(0)!;
          if (!used.has(cp)) used.set(cp, `${file.name}/${ns}`);
        }
      }
    }

    const orphans = [...used]
      .filter(([cp]) => !inRanges(cp, ranges))
      .filter(([cp]) => !DELEGATED.some(d => cp >= d.from && cp <= d.to))
      .map(
        ([cp, where]) =>
          `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)} (${where})`
      );

    expect(orphans).toEqual([]);
  });
});

/** Tailwind's numeric weights, for the classes this codebase actually uses. */
const WEIGHTS: Record<string, number> = {
  'font-thin': 100,
  'font-extralight': 200,
  'font-light': 300,
  'font-normal': 400,
  'font-medium': 500,
  'font-semibold': 600,
  'font-bold': 700,
  'font-extrabold': 800,
  'font-black': 900,
};

describe('no element asks its font for a weight the font does not have', () => {
  it('every .font-display weight is inside the display family declared range', () => {
    const pkg = bundledFontPackages().find(p => p.includes('jakarta'));
    expect(pkg, 'the display font package is not imported anywhere').toBeDefined();
    const css = readFileSync(join(root, 'node_modules', pkg!, 'index.css'), 'utf8');
    const declared = /font-weight:\s*(\d+)\s+(\d+)/.exec(css);
    expect(declared, 'the display family declares no weight range').not.toBeNull();
    const [min, max] = [Number(declared![1]), Number(declared![2])];

    // A weight outside the range does not warn — CSS clamps it to the nearest supported
    // value in silence, so font-black and font-extrabold render identically and the
    // distinction the markup draws is invisible.
    const offenders: string[] = [];
    for (const dir of ['src/components', 'src/pages']) {
      for (const file of walk(join(root, dir))) {
        const text = readFileSync(file, 'utf8');
        for (const m of text.matchAll(/className=\{?[`"'][^`"']*font-display[^`"']*/g)) {
          for (const w of m[0].matchAll(
            /font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g
          )) {
            const n = WEIGHTS[w[0]];
            if (n < min || n > max) {
              offenders.push(`${relative(root, file)}: ${w[0]} (${n}) outside ${min}..${max}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * `line-height` on a display heading must clear the tallest ink the shipped copy can
 * produce, or a two-line heading overlaps itself — line N's `ç` into line N+1's `Í`.
 *
 * Measured over the characters actually present in src/locales (ar/ja excluded, they
 * fall back wholesale), worst-case ink span per shipped face:
 *
 *   Plus Jakarta Sans latin  1.229em      Inter latin      1.196em
 *   Plus Jakarta Sans lat-ext 1.179em     Inter latin-ext  1.149em
 *   SF Pro, which rendered until 2026-08-20: 1.125em
 *
 * So 1.15 cleared SF Pro by +0.025em and clears none of the four faces now shipping.
 * 1.25 clears the worst by +0.021em, restoring the margin the design was drawn against.
 *
 * Recompute if the font packages change — this is the one number here that is measured
 * rather than derived at run time (no font parser in the test environment):
 *   uv run --with fonttools --with brotli python3   # BoundsPen over dist/assets/*.woff2
 */
const DISPLAY_LINE_HEIGHT_FLOOR = 1.25;

describe('display headings clear their own tallest glyphs', () => {
  it('the shared h1/h2/h3/.font-display rule does not set a line-height that overlaps', () => {
    const rule = /h1,\s*h2,\s*h3,\s*\.font-display\s*\{([^}]*)\}/.exec(flatten(stylesCss));
    expect(rule, 'the shared heading rule is gone — find where line-height moved').not.toBeNull();
    const lh = /line-height:\s*([\d.]+)/.exec(rule![1]);
    expect(lh, 'the shared heading rule sets no line-height').not.toBeNull();
    expect(Number(lh![1])).toBeGreaterThanOrEqual(DISPLAY_LINE_HEIGHT_FLOOR);
  });
});
