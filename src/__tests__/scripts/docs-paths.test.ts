import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { docsPaths } from '../../../scripts/docs-paths';

/**
 * `sitemap.xml` is the only thing that tells Google a `/docs/*` page exists: the Jekyll site is
 * built separately (`vercel.json` runs `npm run build && cd docs && jekyll build`), so at
 * sitemap-generation time `dist/docs/` does not exist and the generator's `scanHtmlFiles` cannot
 * discover these pages even in principle.
 *
 * The list therefore used to be typed by hand in `generate-sitemap.ts`, and GH#187 measured it
 * agreeing with the filesystem by luck: 14 entries, 14 files, nothing enforcing it. Add a
 * fifteenth page and forget the array and it ships live, unlisted, with no signal — the shape
 * CLAUDE.md's "no copied facts" rule was written for.
 *
 * This tests the derivation that replaces it. The sources ARE present at generation time —
 * only the *built* docs are missing — so the list can be read rather than checked, which is the
 * same move `noindex-routes.ts` makes against `vercel.json`.
 *
 * ⛔ The refusals are the load-bearing half. Every silent failure mode here produces a *shorter*
 * sitemap, and a shorter sitemap is invisible: no page 404s, no build fails, nothing points a
 * crawler at what is missing. So a page with no permalink throws, and an empty result throws,
 * rather than either returning fewer paths.
 */
const REAL_DOCS = resolve(__dirname, '../../../docs');

const fixtureRoot = mkdtempSync(join(tmpdir(), 'docs-paths-'));
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

let fixtureCount = 0;

/** A throwaway docs tree. `files` maps a path under it to that file's contents. */
function fixture(files: Record<string, string>, config = 'baseurl: "/docs"\n'): string {
  const root = join(fixtureRoot, `case-${++fixtureCount}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, '_config.yml'), config, 'utf-8');
  for (const [name, contents] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents, 'utf-8');
  }
  return root;
}

/** A page as the real ones are written: front matter with a permalink. */
const page = (permalink: string) => `---\ntitle: "x"\npermalink: ${permalink}\n---\n\nbody\n`;

describe('the docs paths the sitemap advertises', () => {
  it('maps the index page onto the baseurl itself', () => {
    // docs/index.md declares `permalink: /`, and the page is served at /docs — not /docs/ and
    // not /. Vercel serves the slash-free form (docs/_config.yml says why jekyll-sitemap was
    // removed), so this is the shape the sitemap must carry.
    expect(docsPaths(fixture({ 'index.md': page('/') }))).toEqual(['/docs']);
  });

  it('prefixes the baseurl and drops the trailing slash on a nested page', () => {
    expect(docsPaths(fixture({ 'compare/vs-x.md': page('/compare/vs-x/') }))).toEqual([
      '/docs/compare/vs-x',
    ]);
  });

  it('reads the baseurl from _config.yml instead of assuming /docs', () => {
    const root = fixture({ 'index.md': page('/') }, 'baseurl: "/handbook"\n');
    expect(docsPaths(root)).toEqual(['/handbook']);
  });

  it('refuses a page that declares no permalink, naming the file', () => {
    // Jekyll's `permalink: pretty` would still serve such a page, at a URL nothing here has
    // verified. Guessing it would put an unverified address in the sitemap; refusing makes the
    // build fail on the commit that adds the page, which is the whole point of GH#187.
    const root = fixture({ 'index.md': page('/'), 'orphan.md': '---\ntitle: "x"\n---\n\nbody\n' });
    expect(() => docsPaths(root)).toThrow(/orphan\.md/);
  });

  it('refuses to return an empty list', () => {
    // The false zero this whole module exists to prevent: run from the wrong working directory
    // and a silent empty result drops every /docs/* URL from the sitemap at once.
    expect(() => docsPaths(fixture({}))).toThrow(/no docs pages/i);
  });

  it('refuses a docs directory whose _config.yml declares no baseurl', () => {
    const root = fixture({ 'index.md': page('/') }, 'title: "x"\n');
    expect(() => docsPaths(root)).toThrow(/baseurl/);
  });

  it('ignores Jekyll machinery directories', () => {
    // _layouts, _includes and a local _site are not pages. A markdown file in one of them
    // carrying a permalink is ambiguous enough to be worth excluding rather than shipping.
    // `_site` matters most: it is a *stale build output* living inside the source tree, so
    // including it would advertise whatever the docs used to say.
    const root = fixture({
      'index.md': page('/'),
      '_layouts/default.md': page('/layout/'),
      '_site/index.md': page('/stale/'),
      '.jekyll-cache/x.md': page('/cached/'),
    });
    expect(docsPaths(root)).toEqual(['/docs']);
  });

  it('ignores README.md, which _config.yml already excludes from the build', () => {
    // Not a page: `exclude:` in docs/_config.yml names it, so Jekyll emits no URL for it and
    // demanding a permalink would fail the build over a file that is documentation for us.
    const root = fixture({ 'index.md': page('/'), 'README.md': '# notes for maintainers\n' });
    expect(docsPaths(root)).toEqual(['/docs']);
  });

  it('refuses a permalink that is not rooted, rather than concatenating it', () => {
    // `permalink: faq/` would silently produce /docsfaq/ — a URL that resolves to nothing and
    // reads as a real entry. Every other failure here shortens the sitemap; this one would
    // lengthen it with an address that 404s.
    const root = fixture({ 'index.md': page('/'), 'faq.md': page('faq/') });
    expect(() => docsPaths(root)).toThrow(/faq\.md/);
  });
});

describe('the derivation against the docs tree as it actually stands', () => {
  const paths = docsPaths(REAL_DOCS);

  it('reads a tree with pages in it', () => {
    // Guards the guard: an empty or tiny result would satisfy the shape assertions below for
    // the wrong reason.
    expect(paths.length).toBeGreaterThan(10);
  });

  it('returns one path per permalink declared anywhere in docs/', () => {
    // An independent count, written differently on purpose: this walks everything and greps,
    // where the derivation walks selectively and parses front matter. If the two disagree the
    // walker is missing a subdirectory — or a `_`-prefixed page has been given a permalink, in
    // which case this failing is the correct signal rather than a nuisance.
    const declared = (function walk(dir: string): number {
      return readdirSync(dir).reduce((total, entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return total + walk(full);
        if (!entry.endsWith('.md')) return total;
        return total + (/^permalink:/m.test(readFileSync(full, 'utf-8')) ? 1 : 0);
      }, 0);
    })(REAL_DOCS);

    expect(paths.length).toBe(declared);
  });

  it('returns the index page and a nested compare page', () => {
    // Anchors for the two mappings that are easy to get wrong: `/` onto the baseurl, and a
    // second path segment surviving intact.
    expect(paths).toContain('/docs');
    expect(paths).toContain('/docs/compare/vs-followsback');
  });

  it('returns slash-free, unique paths under the baseurl', () => {
    expect(paths.filter(path => !path.startsWith('/docs'))).toEqual([]);
    expect(paths.filter(path => path.endsWith('/'))).toEqual([]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('the sitemap generator is the thing that consumes it', () => {
  // A derivation nothing calls is worth nothing, and this file cannot import the generator to
  // find out: `generate-sitemap.ts` ends in a bare `main();`, so importing it would run it.
  // Reading its source is the available instrument (`noindex-routes.ts` documents the same
  // constraint). This is what would fail if someone replaced the call with a literal array.
  const generator = readFileSync(resolve(__dirname, '../../../scripts/generate-sitemap.ts'), 'utf-8');

  it('imports the derivation', () => {
    expect(generator).toMatch(/import\s*\{\s*docsPaths\s*\}\s*from\s*["']\.\/docs-paths["']/);
  });

  it('builds DOCS_PATHS by calling it', () => {
    expect(generator).toMatch(/DOCS_PATHS\s*=\s*docsPaths\(/);
  });
});
