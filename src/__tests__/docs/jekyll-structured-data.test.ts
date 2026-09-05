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
    for (const type of ['speakable', 'HowTo', 'FAQPage', 'TechArticle', 'datePublished']) {
      expect(
        SCRIPT,
        `${type} is excluded by 00-design.md §4 A1 for a researched reason`
      ).not.toContain(type);
    }
  });

  it('grants the two freeze exemptions to the same page', () => {
    // Derived twice from the same config with the same shape, so the assertion is about drift
    // between them rather than about either value. serp-presentation.test.ts independently
    // asserts the title half equals exactly ['instagram-export.md'] with its own, unrelated
    // 120-char window (path: -> title_suffix: true). This window is wider (400, not 120)
    // because it must also reach past the explanatory comment between title_suffix and
    // no_structured_data — widening it here has no effect on that other file's assertion,
    // which never looks for no_structured_data.
    const granted = (key: string): string[] =>
      [...CONFIG.matchAll(new RegExp(`path:\\s*"([^"]+)"[\\s\\S]{0,400}?${key}:\\s*true`, 'g'))].map(
        m => m[1]
      );
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
   * The trailing-slash strip this block's crumb arithmetic depends on invisibly.
   *
   * `crumb_count` is computed as `(canonical_path | split: '/' | size) - 1`, which is correct
   * only because `canonical_path` never carries a trailing slash by the time it reaches this
   * block — default.html:34-39 strips the one Jekyll's pretty permalinks add. Verified against
   * both live shapes: `/docs/instagram-export` gives count 2 with the leaf named from
   * `head_title`; `/docs` gives count 1, so no BreadcrumbList is emitted. If that strip were
   * removed, `/docs/instagram-export/` would compute count 3 instead of 2 and emit a spurious
   * extra ListItem — a rendered document asserting two different addresses for itself, the
   * defect PR #204 fixed one layer over. This does not prove the dependency (only a Jekyll build
   * could), it only pins the strip's presence so a future edit to the head cannot remove it
   * silently.
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
