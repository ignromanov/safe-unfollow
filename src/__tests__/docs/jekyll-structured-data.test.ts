import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The docs layout's JSON-LD, checked as far as a machine without Ruby can check it.
 *
 * System Ruby here is 2.6.10 and Jekyll 4.3 needs 2.7, so nothing in this repository can render
 * this template. Four properties are provable from the source anyway, and each one is a defect
 * this project has already shipped once in a different place:
 *
 *   1. Every author-written value goes through `jsonify`. The head learned this in #184, where
 *      an unescaped description closed its own `content="..."` attribute on the first page whose
 *      prose contained a quote. Inside a <script> the same class is worse: a stray quote makes
 *      the whole block unparseable and the page silently loses all its markup.
 *   2. The skeleton is valid JSON in both of its shapes - with a breadcrumb trail and without.
 *      A missing comma between the two @graph nodes cannot be seen by reading, and would be
 *      invisible in production too, since an invalid block is simply ignored.
 *   3. The freeze is one exemption, not two that can drift. `_config.yml` grants both
 *      `title_suffix` and `no_structured_data` to the same page, and the day one is deleted
 *      without the other, this fails.
 *   4. No docs page's title or description carries an unmeasured latency figure. This block is
 *      the reason that matters here specifically: it puts front matter into machine-readable
 *      form, where `src/__tests__/docs/structured-data-claims.test.tsx`'s own scope comment says
 *      it does not follow ("it does not police prose, docs/, or the README") — because until
 *      this task, docs/ front matter produced no JSON-LD for a caveat to be missing from. Now it
 *      does, so this file is what closes the gap that file names as out of scope, rather than
 *      widening that file past its stated ground.
 *
 * What it cannot prove is that Liquid evaluates as intended. That is a preview deployment's job,
 * and the task file says so.
 *
 * Named `jekyll-structured-data`, not `structured-data`, to sit next to
 * `structured-data-claims.test.tsx` without either name implying it covers the other's layer:
 * that file gates the rendered JSON-LD of four React components, this one gates the text of a
 * Liquid template.
 */
const DOCS_ROOT = join(process.cwd(), 'docs');
const LAYOUT = readFileSync(join(DOCS_ROOT, '_layouts', 'default.html'), 'utf-8');
const CONFIG = readFileSync(join(DOCS_ROOT, '_config.yml'), 'utf-8');

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

/** The block between the sentinels, so this file scans what the task added and nothing else. */
const BLOCK = (() => {
  const start = LAYOUT.indexOf('structured-data:start');
  const end = LAYOUT.indexOf('structured-data:end');
  return start > -1 && end > start ? LAYOUT.slice(start, end) : '';
})();

/**
 * Just the `<script>` payload, not the Liquid comment around it. The comment explains which
 * schema.org types were considered and rejected, by name — so a check for "no excluded type
 * appears" must not scan the comment that names them for exactly that reason, or the
 * documentation trips its own gate. Only what actually reaches the page matters here.
 */
const SCRIPT = (() => {
  const open = BLOCK.indexOf('<script');
  const close = BLOCK.indexOf('</script>');
  return open > -1 && close > open ? BLOCK.slice(open, close) : '';
})();

/**
 * Outputs that must not be jsonified, each for a stated reason. Everything else must be.
 * `crumb_items` is already-built JSON; `crumb_position` and `crumb_count` are integers;
 * `site.url`, `crumb_walk` and `canonical_path` are path-shaped and are concatenated into a
 * value (`crumb_item_url`, `page_canonical_url`) that is itself jsonified.
 */
const NOT_JSONIFIED = new Set([
  'crumb_items',
  'crumb_position',
  'crumb_count',
  'site.url',
  'crumb_walk',
  'canonical_path',
]);

/**
 * A latency claim, in the same shape `structured-data-claims.test.tsx` detects in rendered
 * JSON-LD. Reused verbatim rather than imported: that file's copy is private to its own module
 * and the two gates check different layers (rendered output there, front-matter source here), so
 * a shared import would couple them for no benefit.
 */
const LATENCY_CLAIM = /\b(?:sub[-\s]?)?\d+(?:[.,]\d+)?\s*(?:ms|milliseconds?)\b/i;

/** The control: strings the detector must catch, and strings it must leave alone. */
const KNOWN_VIOLATIONS = [
  'Sub-5ms filtering performance',
  'Filters 1,000,000 accounts in under 5 ms',
  'Search completes in 2 milliseconds',
];
const KNOWN_INNOCENTS = [
  'Instagram Unfollow Tracker',
  'PT5M',
  '1.5.0',
  '2025-11-22',
  'Analyze up to 1,000,000+ accounts',
];

describe('the docs layout emits structured data', () => {
  it('carries the block, once', () => {
    expect(BLOCK, 'no structured-data sentinels in the layout').not.toBe('');
    expect(LAYOUT.match(/type="application\/ld\+json"/g) ?? []).toHaveLength(1);
  });

  it('escapes every author-written value it puts into the script', () => {
    const offenders: string[] = [];
    for (const output of BLOCK.matchAll(/\{\{\s*([^}|]+?)\s*(\|[^}]*)?\}\}/g)) {
      const variable = output[1].trim();
      const filters = output[2] ?? '';
      if (NOT_JSONIFIED.has(variable)) continue;
      if (!/\|\s*jsonify\b/.test(filters)) offenders.push(output[0]);
    }
    expect(offenders, `unescaped output(s) inside the JSON-LD: ${offenders.join(', ')}`).toEqual(
      []
    );
  });

  /**
   * Substitution, not evaluation: every jsonified output becomes a string, the pre-built
   * breadcrumb list becomes one plausible entry, and the conditional is taken both ways. What
   * survives has to parse.
   */
  function render(withBreadcrumbs: boolean): string {
    const open = BLOCK.indexOf('<script');
    const close = BLOCK.indexOf('</script>');
    expect(open, 'no <script> in the block').toBeGreaterThan(-1);
    expect(close, 'no </script> in the block').toBeGreaterThan(open);
    let json = BLOCK.slice(open, close).replace(/<script[^>]*>/, '');
    json = withBreadcrumbs
      ? json.replace(/\{%-?\s*if crumb_count >= 2\s*-?%\}/, '').replace(/\{%-?\s*endif\s*-?%\}/, '')
      : json.replace(/\{%-?\s*if crumb_count >= 2\s*-?%\}[\s\S]*?\{%-?\s*endif\s*-?%\}/, '');
    json = json.replace(
      /\{\{\s*crumb_items\s*\}\}/g,
      '{"@type":"ListItem","position":1,"name":"Docs","item":"https://safeunfollow.app/docs"}'
    );
    return json.replace(/\{\{[^}]*\}\}/g, '"substituted"');
  }

  /**
   * I4: `render()` only ever parses the `@graph` skeleton, substituting the whole
   * `{{ crumb_items }}` output for one plausible entry. The two `{%- capture crumb_entry -%}`
   * bodies that actually build each ListItem — one for an ancestor, one for the final,
   * `item`-less leaf — sit *before* the `<script>` tag and are never sliced into `render()`'s
   * input, so a missing comma or quote inside either one would produce invalid JSON on every
   * page except `/docs` (which emits no BreadcrumbList) while this file kept reporting green —
   * exactly the silent-loss failure mode this file's header says it exists to catch.
   */
  it('each crumb_entry fragment parses as JSON on its own', () => {
    const fragments = [
      ...BLOCK.matchAll(/\{%-?\s*capture crumb_entry\s*-?%\}([\s\S]*?)\{%-?\s*endcapture\s*-?%\}/g),
    ].map(m => m[1]);
    expect(fragments.length, 'expected two crumb_entry capture bodies (ancestor + leaf)').toBe(2);
    for (const fragment of fragments) {
      const substituted = fragment.replace(/\{\{[^}]*\}\}/g, '"substituted"');
      expect(
        () => JSON.parse(substituted),
        `crumb_entry fragment did not parse as JSON: ${fragment}`
      ).not.toThrow();
    }
  });

  it('renders valid JSON with a breadcrumb trail', () => {
    const parsed = JSON.parse(render(true)) as { '@graph': Array<{ '@type': string }> };
    expect(parsed['@graph'].map(node => node['@type'])).toEqual(['WebPage', 'BreadcrumbList']);
  });

  it('renders valid JSON without one', () => {
    const parsed = JSON.parse(render(false)) as { '@graph': Array<{ '@type': string }> };
    expect(parsed['@graph'].map(node => node['@type'])).toEqual(['WebPage']);
  });

  it('emits no type the design excluded', () => {
    // Checked against SCRIPT, not BLOCK: the surrounding Liquid comment names every excluded
    // type on purpose, to record why it was rejected, and a scan of the comment would fail on
    // its own documentation rather than on anything the page actually emits.
    //
    // M1: SCRIPT can be '' if </script> ever preceded <script> inside BLOCK (a reordering that
    // would otherwise pass this test vacuously, the same trap the earlier `<script>`-in-prose
    // bug took the shape of). Assert it is non-empty before trusting `.not.toContain` on it.
    expect(SCRIPT, 'no script payload extracted').not.toBe('');
    for (const type of ['speakable', 'HowTo', 'FAQPage', 'TechArticle', 'datePublished']) {
      expect(
        SCRIPT,
        `${type} is excluded by 00-design.md §4 A1 for a researched reason`
      ).not.toContain(type);
    }
  });

  /**
   * C1: the config half of the exemption is gated by nothing on the layout side. Deleting the
   * `{%- unless page.no_structured_data -%}` guard around the `<script>` leaves `_config.yml`
   * still granting the exemption and every other assertion in this file still green — the freeze
   * would silently stop doing anything. Assert the mechanism itself, the same shape
   * `serp-presentation.test.ts:114-117` uses for `title_suffix` ("Assert the mechanism, not just
   * the values"), and check that the guard actually wraps the emitted script rather than merely
   * appearing somewhere in the block.
   */
  it('gates the emitted script on the same flag the freeze grants', () => {
    const unlessOpen = BLOCK.search(/\{%-?\s*unless\s+page\.no_structured_data\s*-?%\}/);
    const unlessClose = BLOCK.indexOf('endunless');
    const scriptOpen = BLOCK.indexOf('<script');
    const scriptClose = BLOCK.indexOf('</script>');
    expect(unlessOpen, 'no {% unless page.no_structured_data %} guard in the block').toBeGreaterThan(
      -1
    );
    expect(unlessClose, 'no matching {% endunless %} in the block').toBeGreaterThan(unlessOpen);
    expect(scriptOpen, 'the unless guard does not wrap the start of <script>').toBeGreaterThan(
      unlessOpen
    );
    expect(scriptClose, 'the unless guard does not wrap the end of </script>').toBeLessThan(
      unlessClose
    );
  });

  /**
   * I3: a character-count window (the plan's original `{0,200}`, widened here to 400 to clear an
   * explanatory YAML comment) can match one page's `path:` against a *different* page's
   * `values:` block once a config grows — proved by constructing a `_config.yml` shape where the
   * window spans the boundary between two `defaults:` entries. `serp-presentation.test.ts` hit
   * the identical class one file over and answered it by parsing with a real YAML parser rather
   * than guessing a window; same fix here, on the same file this test already reads structurally
   * via `matchAll` before this round. Not "widen the window again" — remove it.
   */
  it('grants the two freeze exemptions to the same page', async () => {
    const { parse: parseYAML } = await import('yaml');
    const parsed = parseYAML(CONFIG) as {
      defaults?: Array<{ scope?: { path?: string }; values?: Record<string, unknown> }>;
    };
    const granted = (key: string): string[] =>
      (parsed.defaults ?? [])
        .filter(entry => entry.values?.[key] === true)
        .map(entry => entry.scope?.path ?? '');
    expect(granted('no_structured_data')).toEqual(granted('title_suffix'));
    expect(granted('no_structured_data')).toEqual(['instagram-export.md']);
  });

  it('leaves no page able to break out of the script element', () => {
    // `jsonify` escapes quotes; it does not escape a slash, so a literal `</script>` in a title
    // or description would end the element and spill the rest of the JSON into the document.
    for (const doc of DOCS) {
      const front = /^---\n([\s\S]*?)\n---\n/.exec(doc.text)?.[1] ?? '';
      for (const field of ['title', 'description']) {
        const value = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(front)?.[1] ?? '';
        expect(value, `${doc.name}'s ${field} contains a tag delimiter`).not.toMatch(/[<>]/);
      }
    }
  });

  /**
   * The trailing-slash strip this block depends on for a reason narrower than first stated.
   *
   * ⚠️ CORRECTED (fix round 1): the original docstring here claimed removing the strip would
   * change `crumb_count` (count 3 instead of 2, a spurious extra ListItem). That is false — Liquid's
   * `split` delegates to Ruby's `String#split`, which drops trailing empty fields, so
   * `"/docs/instagram-export/".split("/")` and `"/docs/instagram-export".split("/")` are the same
   * array. The trailing slash cannot change the crumb count at any depth.
   *
   * What the strip actually guards: without it, `page_canonical_url` (built from
   * `canonical_path`) and every ancestor `item` URL would carry the trailing slash Jekyll's
   * pretty permalinks add — and Vercel's `trailingSlash: false` 308-redirects that URL away from
   * itself. The `@id`/`url` in the WebPage node and the `<link rel="canonical">` above it (built
   * from the same `canonical_path`) would then name an address that does not serve, disagreeing
   * with the URL search engines are actually shown — the same class of defect PR #204 fixed one
   * layer over, just not via the crumb count.
   *
   * The assertion is unchanged and still goes red when the strip is deleted (verified in review);
   * only the reasoning above it was wrong and is corrected here.
   */
  it('pins the trailing-slash strip the crumb arithmetic depends on (default.html:34-39)', () => {
    expect(
      LAYOUT,
      'the canonical_path trailing-slash strip is missing — crumb_count would then count an ' +
        'extra empty segment on every pretty-permalink page'
    ).toMatch(
      /canonical_last == ['"]\/['"][\s\S]{0,200}canonical_path \| slice: 0, canonical_trimmed/
    );
  });
});

describe('docs front matter states no unmeasured performance figure', () => {
  // Same detector, control and reasoning as structured-data-claims.test.tsx, applied to the
  // input this task turns into machine-readable form for the first time: docs/ front matter.
  // That file's own scope comment says it "does not police prose, docs/, or the README" — this
  // is what closes that gap now that docs/ has a JSON-LD surface, not a widening of that file.
  it('the detector can go red on a docs-shaped latency claim', () => {
    expect(KNOWN_VIOLATIONS.filter(text => !LATENCY_CLAIM.test(text))).toEqual([]);
  });

  it('the detector does not fire on versions, durations, dates or counts', () => {
    expect(KNOWN_INNOCENTS.filter(text => LATENCY_CLAIM.test(text))).toEqual([]);
  });

  it('no docs page states a latency figure in its title or description', () => {
    const offenders: string[] = [];
    for (const doc of DOCS) {
      const front = /^---\n([\s\S]*?)\n---\n/.exec(doc.text)?.[1] ?? '';
      for (const field of ['title', 'description']) {
        const value = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(front)?.[1] ?? '';
        if (LATENCY_CLAIM.test(value)) offenders.push(`${doc.name}:${field} = ${value}`);
      }
    }
    expect(
      offenders,
      `docs page(s) state a latency figure that reaches JSON-LD with no caveat: ${offenders.join(' | ')}`
    ).toEqual([]);
  });
});
