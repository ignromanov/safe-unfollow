import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const DOCS_ROOT = join(process.cwd(), 'docs');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'assets' ? [] : markdownFiles(full);
    return full.endsWith('.md') ? [full] : [];
  });
}

const DOCS = markdownFiles(DOCS_ROOT).map(path => ({
  name: relative(DOCS_ROOT, path),
  text: readFileSync(path, 'utf-8'),
}));

const LAYOUT = readFileSync(join(DOCS_ROOT, '_layouts', 'default.html'), 'utf-8');

/** The one `<style>` block the site has. Every rule below has to live in it. */
const CSS = /<style>([\s\S]*?)<\/style>/.exec(LAYOUT)?.[1] ?? '';

/**
 * Smallest viewport worth designing for — an iPhone SE in portrait. 85% of this
 * property's traffic is mobile, so this is the common case, not the edge one.
 */
const NARROW_VIEWPORT = 375;

/**
 * Reads a PNG's intrinsic size from its IHDR chunk, which is fixed at bytes
 * 16..24 of every PNG. Read rather than tabulated: a dimension written down by
 * hand is the class of fact this repo has watched drift four times.
 */
function pngSize(path: string): { width: number; height: number } {
  const head = readFileSync(path).subarray(0, 24);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/**
 * Every image the docs reference, with the markdown that declares it. Kramdown
 * turns `![alt](src)` into a bare `<img src alt>` — no width, no height, no
 * loading — so anything else the browser needs has to be an inline attribute
 * list (`{: width="…"}`) written beside the image.
 */
const IMAGES = DOCS.flatMap(doc =>
  [...doc.text.matchAll(/!\[[^\]]*\]\((\/docs\/([^)]+))\)(\{:[^}]*\})?/g)].map(m => ({
    page: doc.name,
    url: m[1],
    file: join(DOCS_ROOT, m[2]),
    ial: m[3] ?? '',
  })),
);

describe('docs layout — the page fits the viewport it is read on', () => {
  it('has images to check at all', () => {
    // Guards the three assertions below: an empty match set passes them all
    // vacuously, and the regex above is the kind that silently stops matching.
    expect(IMAGES.length).toBeGreaterThan(0);
  });

  it('constrains images to their container', () => {
    // `body { max-width: 800px }` bounds the container, not the replaced element
    // inside it. Without this rule a 2950px screenshot lays out at 2950px and
    // takes the whole document with it — the page scrolls sideways and the prose
    // leaves the screen.
    const rule = /(^|[\s,{}])img\b[^{]*\{([^}]*)\}/m.exec(CSS);
    expect(rule, 'the stylesheet declares no img rule').not.toBeNull();
    expect(rule![2]).toMatch(/max-width:\s*100%/);
    // Clamping width alone would squash the image; height:auto keeps the ratio.
    expect(rule![2]).toMatch(/height:\s*auto/);
  });

  it.each(IMAGES)('$page declares the real size of $url', image => {
    // With `height: auto` and no declared size the browser reserves no box until
    // the bytes arrive, then reflows the article under the reader's thumb. The
    // width/height pair is what lets it reserve the right aspect ratio up front.
    const width = /width="(\d+)"/.exec(image.ial)?.[1];
    const height = /height="(\d+)"/.exec(image.ial)?.[1];
    expect(width, `${image.url} declares no width`).toBeDefined();
    expect(height, `${image.url} declares no height`).toBeDefined();

    // Read from the file, never from the markdown: a declared ratio that drifts
    // from the real one distorts the image instead of merely failing to reserve.
    const actual = pngSize(image.file);
    expect({ width: Number(width), height: Number(height) }).toEqual(actual);
  });

  it.each(IMAGES)('$page defers $url off the critical path', image => {
    // Both screenshots sit below the fold on every viewport. Fetching them
    // eagerly spends the mobile connection before the prose above them renders.
    expect(image.ial).toMatch(/loading="lazy"/);
  });

  it('narrows its horizontal chrome on a phone', () => {
    // body padding 20px + .container padding 40px, on both sides, is 120px of
    // the 375px an iPhone SE has — a third of the screen spent on margin.
    const query = new RegExp(`@media[^{]*max-width:\\s*(\\d+)px`, 'g');
    const breakpoints = [...CSS.matchAll(query)].map(m => Number(m[1]));
    expect(breakpoints, 'the stylesheet has no @media query').not.toHaveLength(0);
    expect(Math.max(...breakpoints)).toBeGreaterThanOrEqual(NARROW_VIEWPORT);
  });

  it('breaks a token too long for the column instead of widening the page', () => {
    // `pre` has scrolled since before this file existed; inline `code` never
    // has, and the longest path in this corpus is 54 characters. Measured at
    // 375px: 511px of `code` in a 315px column, 166px of document overflow.
    const rule = /(^|[\s,{}])body\s*\{([^}]*)\}/m.exec(CSS);
    expect(rule, 'the stylesheet declares no body rule').not.toBeNull();
    expect(rule![2]).toMatch(/overflow-wrap:\s*(break-word|anywhere)/);
  });

  it('lets a wide table scroll inside itself rather than widening the page', () => {
    // Eight of these pages carry tables of up to five columns with prose cells.
    // A table has no width it can be told to respect, so the choice is between
    // the table scrolling and the document scrolling.
    const rule = /(^|[\s,{}])table\b[^{]*\{([^}]*)\}/m.exec(CSS);
    expect(rule, 'the stylesheet declares no table rule').not.toBeNull();
    expect(rule![2]).toMatch(/overflow-x:\s*auto/);
  });
});

/** The `.container` these pages render their prose inside. */
const PROSE_BACKDROP = '#ffffff';

/** WCAG 2.1 AA for text below 18.66px bold / 24px regular — which is all of it here. */
const AA_TEXT = 4.5;

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('docs layout — the palette keeps the promise the pages make', () => {
  /**
   * `accessibility.md` tells readers, in its body and in its meta description,
   * that the product follows WCAG 2.1 AA. The stylesheet it is rendered by is
   * the thing that either honours that or does not, and until this gate existed
   * the two could disagree indefinitely: the page said AA while every link on
   * all fourteen pages measured 3.15:1 against a 4.5:1 requirement.
   *
   * The conditional is the point. If the claim is ever withdrawn this gate
   * withdraws with it, rather than enforcing a standard nobody promised.
   */
  const ACCESSIBILITY = readFileSync(join(DOCS_ROOT, 'accessibility.md'), 'utf-8');
  const CLAIMS_AA = /WCAG\s*2\.1\s*AA/i.test(ACCESSIBILITY);

  it.runIf(CLAIMS_AA)('renders body links at AA against the container', () => {
    const rule = /(^|[\s,{}])a\s*\{([^}]*)\}/m.exec(CSS);
    const color = /color:\s*(#[0-9a-f]{6})/i.exec(rule?.[2] ?? '')?.[1];
    expect(color, 'no link colour found').toBeDefined();
    expect(contrast(color!, PROSE_BACKDROP)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.runIf(CLAIMS_AA)('renders nav buttons at AA in both rest and hover', () => {
    const rest = /\.back-link\s*\{([^}]*)\}/m.exec(CSS)?.[1] ?? '';
    const hover = /\.back-link:hover\s*\{([^}]*)\}/m.exec(CSS)?.[1] ?? '';
    const label = /(?:^|;)\s*color:\s*(\w+|#[0-9a-f]{6})/i.exec(rest)?.[1];
    const restFill = /background:\s*(#[0-9a-f]{6})/i.exec(rest)?.[1];
    const hoverFill = /background:\s*(#[0-9a-f]{6})/i.exec(hover)?.[1];
    expect({ label, restFill, hoverFill }).toEqual({
      label: expect.anything(),
      restFill: expect.anything(),
      hoverFill: expect.anything(),
    });
    // The label is `white` by keyword, not by hex; resolve the one keyword used.
    const labelHex = label === 'white' ? '#ffffff' : label!;
    // Hover is a state the reader can sit in, so it carries the same duty.
    expect(contrast(labelHex, restFill!)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(labelHex, hoverFill!)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('states the claim this gate is conditioned on', () => {
    // Guards the two `runIf`s above: if the phrasing in accessibility.md drifts,
    // both would skip silently and the palette would go unchecked.
    expect(CLAIMS_AA).toBe(true);
  });
});

describe('docs FAQ — the structured data says what the page says', () => {
  /**
   * Google shows FAQ rich results only where the schema's questions and answers
   * are visible on the page. That parity is not something a JSON file can hold
   * on its own: `faq.md` is edited by people and `faq-page-schema.html` is not
   * regenerated when they do. So this gate re-derives both sides from the page
   * and compares, rather than reading the schema and believing it.
   */
  const FAQ = readFileSync(join(DOCS_ROOT, 'faq.md'), 'utf-8');
  const SCHEMA = readFileSync(join(DOCS_ROOT, '_includes', 'faq-page-schema.html'), 'utf-8');
  const JSON_LD = JSON.parse(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(SCHEMA)![1],
  );

  /** Flattens one question's markdown body the way the schema stores it. */
  function plain(markdown: string): string {
    return markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => (line.startsWith('- ') ? line.slice(2).trim() : line))
      .join(' ');
  }

  const entries: Array<{ name: string; acceptedAnswer: { text: string } }> = JSON_LD.mainEntity;

  it('is a FAQPage the page actually carries', () => {
    expect(JSON_LD['@type']).toBe('FAQPage');
    expect(entries.length).toBeGreaterThan(0);
    expect(FAQ).toContain('{% include faq-page-schema.html %}');
  });

  it.each(entries.map(e => e.name))('asks %s as a visible heading', name => {
    expect(FAQ).toContain(`### ${name}\n`);
  });

  it.each(entries)('answers $name with the page’s own words', entry => {
    const body = new RegExp(
      // `$` under the `m` flag is end-of-LINE, so a lazy body capture stops at the
      // first newline and every multi-line answer silently truncates. `$(?![\s\S])`
      // is end-of-input. Found by this gate disagreeing with the generated file.
      `^### ${entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n#{2,3} |$(?![\\s\\S]))`,
      'm',
    ).exec(FAQ);
    expect(body, `no body found under ${entry.name}`).not.toBeNull();
    expect(entry.acceptedAnswer.text).toBe(plain(body![1]));
  });

  it('leaves the "is it safe" query to the page built for it', () => {
    // /docs/is-it-safe is a whole page on that intent and carries its own
    // FAQPage. Two of our URLs competing for one query splits the authority
    // between them; this asserts the omission is deliberate and stays that way.
    expect(entries.map(e => e.name).join(' ')).not.toMatch(/is it safe/i);
    expect(readFileSync(join(DOCS_ROOT, 'is-it-safe.md'), 'utf-8')).toContain(
      '{% include faq-schema.html %}',
    );
  });
});
