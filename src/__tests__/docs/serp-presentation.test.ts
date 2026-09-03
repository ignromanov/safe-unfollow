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

const CONFIG = readFileSync(join(DOCS_ROOT, '_config.yml'), 'utf-8');
const LAYOUT = readFileSync(join(DOCS_ROOT, '_layouts', 'default.html'), 'utf-8');

/**
 * What Google renders of a title. The pixel budget is about 580px, which is
 * roughly sixty characters in the fonts it uses — an approximation, and the
 * reason this is a ceiling rather than a target. Every page here was between 79
 * and 101 characters when this gate was written.
 */
const TITLE_BUDGET = 60;

/** The suffix the layout appends for a page that opts in via `title_suffix`. */
const SUFFIX = ' - Instagram Unfollow Tracker';

/**
 * Pages `_config.yml` exempts, read from the config rather than listed here, so
 * the exemption cannot be granted in one file and forgotten in the other.
 *
 * Regex rather than a YAML parse because the shape is fixed and adding a parser
 * to reach four lines is not worth the dependency: a `defaults:` entry whose
 * `values:` block sets `title_suffix: true`, keyed by its `scope.path`.
 */
const FROZEN = [...CONFIG.matchAll(/path:\s*"([^"]+)"[\s\S]{0,120}?title_suffix:\s*true/g)].map(
  m => m[1],
);

function frontMatter(text: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!block) return {};
  return Object.fromEntries(
    block[1]
      .split('\n')
      .map(line => /^([a-z_]+):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => [m[1], unquote(m[2].trim())]),
  );
}

/** A double- or single-quoted YAML scalar, with the quotes taken off. */
function unquote(value: string): string {
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);
  return quoted ? (quoted[1] ?? quoted[2]).replace(/''/g, "'") : value;
}

/**
 * Whether YAML would read this value as the string it looks like.
 *
 * The reason this exists is a bug this file's first version shipped to a preview
 * and did not catch. Seven titles were rewritten to use a colon — `title:
 * Instagram Unfollow Tracker FAQ: No Login, Free, Private` — and an unquoted YAML
 * scalar containing ": " is not a string, so Jekyll parsed no front matter and
 * every one of those pages rendered the site-wide fallback title instead.
 *
 * The gate passed anyway, because a regex reads `title:` in places YAML does not.
 * That is the same defect class the corpus decision of 2026-09-03 names: a check
 * that keys on the shape of the text rather than on the fact it stands for.
 *
 * ⚠️ It was already live. `compare/vs-followers-app.md` merged in #183 with a
 * description opening on a double quote, and production served the fallback title
 * and fallback description for that page until this branch.
 *
 * Requiring the quotes, rather than reimplementing YAML's plain-scalar rules,
 * makes the whole class impossible without adding a parser dependency.
 */
function isQuoted(raw: string): boolean {
  return /^".*"$/.test(raw) || /^'.*'$/.test(raw);
}

function rawField(text: string, field: string): string {
  const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text);
  return m ? m[1].trim() : '';
}

describe('every published page fits the search result it appears in', () => {
  it('finds the docs corpus', () => {
    expect(DOCS.length).toBeGreaterThan(10);
  });

  // The layout owns the suffix, so a page cannot fix its own truncation by
  // editing its front matter alone. Assert the mechanism, not just the values.
  it('appends the brand suffix only for a page that opts in', () => {
    expect(LAYOUT).toMatch(/if page\.title_suffix/);
    expect(LAYOUT, 'og:title and twitter:title reuse the one computed title').toMatch(
      /og:title" content="\{\{ head_title \| escape \}\}"/,
    );
  });

  /**
   * A front-matter value reaching an HTML attribute unescaped is not a style
   * question here: `compare/vs-followers-app.md`'s description opens on a double
   * quote, and the first build that parsed it emitted `content=""` because the
   * attribute closed on the page's own text. Nothing escaped anything until then,
   * which stayed invisible only while no page's prose contained a quote.
   */
  it('escapes every front-matter value it puts into the page head', () => {
    expect(LAYOUT, 'an unescaped title reaches the head').not.toMatch(/\{\{\s*head_title\s*\}\}/);
    expect(LAYOUT, 'an unescaped description reaches the head').not.toMatch(
      /\{\{\s*page\.description\s*\}\}/,
    );
  });

  /**
   * ⛔ This is a dated exemption, not a permanent one. `/docs/instagram-export`
   * keeps its over-long title while its ranking recovers from the W34 collapse;
   * task 05 of the position-content plan rewrites it after the W37 chart, and
   * deletes the `_config.yml` entry with it. Asserting the count keeps a second
   * page from quietly joining it.
   */
  it('exempts exactly one page, and names which', () => {
    expect(FROZEN).toEqual(['instagram-export.md']);
  });

  for (const doc of DOCS) {
    const meta = frontMatter(doc.text);
    const frozen = FROZEN.includes(doc.name);

    it(`${doc.name} renders a title search results can show whole`, () => {
      expect(meta.title, `${doc.name} declares no title`).toBeTruthy();
      const rendered = frozen ? `${meta.title}${SUFFIX}` : meta.title;
      expect(
        rendered.length,
        `${doc.name} renders <title> as ${rendered.length} chars: "${rendered}"`,
      ).toBeLessThanOrEqual(frozen ? 90 : TITLE_BUDGET);
    });

    it(`${doc.name} quotes the two front-matter fields that carry prose`, () => {
      // The frozen page is skipped for the same reason it keeps its title: the
      // position-content plan holds the file closed until the W37 chart, and adding
      // quotes would be an edit to it. Its front matter parses today — checked
      // 2026-09-03 — and task 05 brings it under this rule when it opens the file.
      if (frozen) return;
      for (const field of ['title', 'description']) {
        const raw = rawField(doc.text, field);
        expect(raw, `${doc.name} declares no ${field}`).not.toBe('');
        expect(
          isQuoted(raw),
          `${doc.name}'s ${field} is unquoted: ${raw}. A colon, or a leading quote, makes YAML read it as something other than a string, and Jekyll then renders the fallback.`,
        ).toBe(true);
      }
    });

    it(`${doc.name} dates itself`, () => {
      // Seven pages carried this field while no template read it, and four of
      // those seven had drifted eight months out of date — invisibility is what
      // let them drift. Rendered now, so a wrong date is a wrong date on screen.
      expect(meta.last_updated, `${doc.name} carries no last_updated`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        meta.last_updated <= new Date().toISOString().slice(0, 10),
        `${doc.name} is dated in the future`,
      ).toBe(true);
    });

    it(`${doc.name} links to other docs pages without a trailing slash`, () => {
      // Measured 2026-09-03 against production: /docs/faq returns 200 and
      // /docs/faq/ returns 308, directory indexes included. Every internal link
      // in this corpus ended in a slash until this gate; the slash-free form is
      // also the one scripts/generate-sitemap.ts emits.
      const redirecting = [...doc.text.matchAll(/\]\((\/docs\/[A-Za-z0-9/_-]*)\/\)/g)].map(m => m[1]);
      expect(redirecting, `${doc.name} links through a 308 redirect`).toEqual([]);
    });
  }
});
