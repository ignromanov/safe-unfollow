import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
 * The app half of the site, read only for the one fact this file must not copy:
 * which image the property uses as its social card. `index.html` decides it for
 * every prerendered route; the docs layout has to agree rather than restate.
 */
const APP_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf-8');

/** The card path `index.html` declares, e.g. `/og-image.png`. */
const APP_CARD = /<meta property="og:image" content="https:\/\/safeunfollow\.app(\/[^"]+)"/.exec(
  APP_HTML,
)?.[1];

/**
 * What Google renders of a title. The pixel budget is about 580px, which is
 * roughly sixty characters in the fonts it uses — an approximation, and the
 * reason this is a ceiling rather than a target. Every page here was between 79
 * and 101 characters when this gate was written.
 */
const TITLE_BUDGET = 60;

/** The suffix the layout appends for a page that opts in via `title_suffix`. */
const SUFFIX = ' - Instagram Unfollow Tracker';

/** What Google renders of a meta description before it truncates — about 160 characters. */
const DESCRIPTION_BUDGET = 160;

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
   *
   * `<title>` content is not an HTML attribute, so it sits outside the derived
   * check below and keeps its own assertion.
   */
  it('escapes every front-matter value it puts into the page head', () => {
    expect(LAYOUT, 'an unescaped title reaches the head').not.toMatch(/\{\{\s*head_title\s*\}\}/);
  });

  /**
   * The bare-string version of this check — `not.toMatch(/\{\{\s*page\.description\s*\}\}/)`
   * — went red the moment `head_description` became a `capture`: the capture's own body
   * legitimately reads `{{ page.description }}` unescaped, because escaping happens once,
   * on the way out, when the captured variable is read with `| escape`. That check was
   * asserting the shape of the source rather than the property that matters — whether an
   * output that reaches an attribute is escaped — so it is dropped here in favour of a
   * derived version that reads the property directly.
   *
   * This is the same defect class `wizard-routing.test.ts` closed for error-code routing
   * (commit `3fa131b`, PR #174): a hand-written list of subjects passes green while a
   * subject nobody enumerated ships broken. Here the subjects are every Liquid output
   * that lands inside an HTML attribute value in the `<head>`, derived rather than named,
   * so a new field reaching the head — or an existing one losing its `| escape` — fails
   * without anyone having to remember to add it to a list.
   */
  it('escapes every Liquid output that reaches a head <meta>/<link> attribute value', () => {
    const head = /<head>[\s\S]*?<\/head>/.exec(LAYOUT)?.[0] ?? '';
    // `capture` bodies are intermediate assignment, not page output — strip them so their
    // raw, unescaped reads of `page.title` / `page.description` are not mistaken for a leak.
    const withoutCaptures = head.replace(
      /\{%-?\s*capture\s+\w+\s*-?%\}[\s\S]*?\{%-?\s*endcapture\s*-?%\}/g,
      '',
    );
    // Path-shaped values, not author-written prose — `site.url` and `canonical_path` can
    // never carry a quote or an ampersand the way a title or description can.
    const PATH_ALLOWLIST = new Set(['site.url', 'canonical_path']);
    const attributeValues = [...withoutCaptures.matchAll(/="([^"]*\{\{[^"]*)"/g)].map(m => m[1]);
    const offenders: string[] = [];
    for (const value of attributeValues) {
      for (const output of value.matchAll(/\{\{\s*([^}|]+?)\s*(\|[^}]*)?\}\}/g)) {
        const variable = output[1].trim();
        const filters = output[2] ?? '';
        if (PATH_ALLOWLIST.has(variable)) continue;
        if (!/\|\s*escape\b/.test(filters)) offenders.push(output[0]);
      }
    }
    expect(offenders, `unescaped output(s) reaching a head attribute: ${offenders.join(', ')}`).toEqual(
      [],
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

  /**
   * `FROZEN` above is read from `_config.yml` alone, and every title-length assertion in
   * this file trusts that as the complete list. The layout does not: `{%- if
   * page.title_suffix -%}` (asserted in "appends the brand suffix only for a page that
   * opts in") reads `page.title_suffix`, which Jekyll resolves from a page's own front
   * matter first and falls back to `_config.yml`'s `defaults:` only when the page is
   * silent. A page that set `title_suffix: true` itself would render the longer title at
   * build time while this file kept scoring its bare `meta.title` against the 60-character
   * budget — a 90-character title passing a 60-character rule, invisibly, because the one
   * place this file looks for the exemption is not the only place Jekyll grants it.
   */
  it('grants title_suffix only from _config.yml, never from a page itself', () => {
    for (const doc of DOCS) {
      expect(rawField(doc.text, 'title_suffix'), `${doc.name} sets its own title_suffix`).toBe('');
    }
  });

  /**
   * Measured on production 2026-09-03: all thirteen published pages served **no**
   * `og:image`, so `twitter:card` had to stay at the small `summary` square. It had
   * never been otherwise — this layout has hand-written og:title/description/url/type
   * since `4ad0229b` created it, and `jekyll-seo-tag` emits an image only from
   * `page.image` or `site.image`/`site.logo`, neither of which `_config.yml` sets.
   *
   * The failure is not the missing tag, it is what a scraper does instead: with no
   * `og:image` it falls back to the first image in the body, and `/docs/user-guide`
   * therefore represented itself with `assets/upload-zip.png`. A page cannot choose
   * that fallback and cannot see it.
   *
   * `APP_CARD` is read from `index.html` rather than written here, so the two halves
   * of the property cannot drift apart the way this file's own `FROZEN` list was
   * designed not to — `CLAUDE.md` -> "No copied facts".
   */
  it('gives every published page the same social card the app uses', () => {
    expect(APP_CARD, 'index.html declares no absolute og:image').toBeTruthy();
    expect(existsSync(join(process.cwd(), 'public', APP_CARD as string))).toBe(true);
    expect(LAYOUT).toContain(`<meta property="og:image" content="{{ site.url }}${APP_CARD}">`);
    expect(LAYOUT).toContain(`<meta name="twitter:image" content="{{ site.url }}${APP_CARD}">`);
  });

  /**
   * `summary` renders a small square thumbnail and `summary_large_image` the 1200x630
   * card the image is actually cut for. The layout hardcoded the former while declaring
   * no image at all, which was at least consistent; declaring a 1200x630 card and
   * leaving the small type is the one combination that is worse than either.
   */
  it('asks for the card size the image is cut for', () => {
    expect(LAYOUT).toContain('<meta name="twitter:card" content="summary_large_image">');
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

    it(`${doc.name} writes a description the snippet can show whole`, () => {
      // Same defect one field over, and it was on five pages when this was added —
      // one at 240 characters. Measured on the source string, not the rendered
      // attribute: `escape` turns an apostrophe into `&#39;` and inflates the
      // count by four, while the reader sees one character.
      expect(meta.description, `${doc.name} declares no description`).toBeTruthy();
      expect(
        meta.description.length,
        `${doc.name} writes a ${meta.description.length}-character description`,
      ).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    });

    it(`${doc.name} quotes the two front-matter fields that carry prose`, () => {
      // No exemption here, even for the frozen page. This check used to `return` early
      // for it, on the reasoning that the title-length exemption and this one were the
      // same freeze — they are not. `_config.yml`'s `title_suffix` is about how long a
      // title search results are allowed to show; this rule is about whether YAML reads
      // the file's front matter at all, which has nothing to do with SERP presentation.
      // Riding one flag for both is what let this go unnoticed: `instagram-export.md`'s
      // description was an unquoted plain scalar reading `... Avoid the #1 upload
      // mistake.` — YAML reads a `#` after a space as the start of a comment, so of the
      // 129 characters written, 110 reached production, cut mid-sentence at "Avoid the".
      for (const field of ['title', 'description']) {
        const raw = rawField(doc.text, field);
        expect(raw, `${doc.name} declares no ${field}`).not.toBe('');
        expect(
          isQuoted(raw),
          `${doc.name}'s ${field} is unquoted: ${raw}. A colon, or a leading quote, makes YAML read it as something other than a string, and Jekyll then renders the fallback.`,
        ).toBe(true);
      }
    });

    it(`${doc.name}'s title and description read the same to this file's regex as to YAML`, async () => {
      // The deeper defect behind both bugs this file documents — the colon titles and the
      // `#1` description — is not "unquoted values exist", it is that `frontMatter()` reads
      // front matter with a regex, and a regex can read a value in a place YAML reads
      // something else entirely. Quoting closes the two known shapes of that gap; this
      // closes the class, by checking the reader against a real parser directly rather than
      // against a proxy rule about quote characters.
      //
      // `yaml` is not a declared dependency (js-yaml is present too, both transitive) — no
      // dependency is added for four lines of comparison, and the import happens inside the
      // test rather than at module scope so a resolution change elsewhere in the tree fails
      // this one check, not the whole suite. If it cannot be imported, fail loudly and name
      // why: a check that quietly no-ops is the exact failure mode this file exists to catch.
      let parseYAML: (source: string) => Record<string, unknown>;
      try {
        ({ parse: parseYAML } = await import('yaml'));
      } catch (err) {
        throw new Error(
          `could not import "yaml" to verify ${doc.name} against a real parser: ${String(err)}. ` +
            'This check cannot silently pass — fix the import, do not delete the assertion.',
        );
      }
      const block = /^---\n([\s\S]*?)\n---\n/.exec(doc.text);
      const parsed = block ? parseYAML(block[1]) : {};
      for (const field of ['title', 'description'] as const) {
        const regexRead = meta[field];
        const yamlRead = parsed[field] === undefined ? undefined : String(parsed[field]);
        expect(
          regexRead,
          `${doc.name}'s ${field}: this file's regex reads ${JSON.stringify(regexRead)}, YAML reads ${JSON.stringify(yamlRead)}`,
        ).toBe(yamlRead);
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
