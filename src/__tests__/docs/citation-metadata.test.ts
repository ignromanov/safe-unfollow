import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RTL_LANGUAGES, SUPPORTED_LANGUAGES } from '@/config/languages';

const ROOT = process.cwd();

const read = (name: string): string => readFileSync(join(ROOT, name), 'utf-8');

const PACKAGE = JSON.parse(read('package.json')) as {
  version: string;
  license: string;
  homepage: string;
  repository: { url: string };
};

/** `git+https://github.com/o/r.git` is the same repository as `https://github.com/o/r`. */
const normalizeRepo = (url: string): string => url.replace(/^git\+/, '').replace(/\.git$/, '');

/**
 * CITATION.cff, the LICENSE and the README all state who this project is and what
 * version it is at. Nothing used to hold them together.
 *
 * Measured 2026-09-08, while scoping the first GitHub release and a Zenodo DOI: the
 * repository named itself four different ways — README's H1 said "Instagram Unfollow
 * Tracker", package.json said "safe-unfollow", 72 files said "SafeUnfollow", and LICENSE
 * said "Unfollow Radar Contributors", a name that appeared in no other file in the tree.
 * The version disagreed three ways at the same time: package.json 1.6.0, README's badge
 * 1.5.0, CHANGELOG's last released entry 1.5.0.
 *
 * That is ordinary drift everywhere else. It is not ordinary here, because Zenodo mints a
 * DOI from the release and Software Heritage snapshots the tree, and neither can be
 * rewritten afterwards. A contradiction archived is permanent.
 *
 * So this file does what `architecture-facts.test.ts` does for the page count: it derives
 * the citation metadata from the one file that decides it — package.json — instead of
 * trusting a second hand-typed copy. The README's version badge was the fifth copy and is
 * now a shields.io endpoint that reads package.json itself; the last assertion here keeps
 * anyone from typing it back in.
 */
describe('citation metadata', () => {
  // A regex can read a value in a place YAML reads something else entirely — measured in
  // this repository on 2026-09-03, when `vs-followers-app.md` shipped a description opening
  // on a double quote, YAML parsed no front matter at all, and the live page served the
  // site-wide fallback past a gate written that morning. So: a real parser, imported inside
  // the test as `serp-presentation.test.ts` does, failing loudly rather than skipping.
  const loadCitation = async (): Promise<Record<string, unknown>> => {
    let parseYAML: (source: string) => Record<string, unknown>;
    try {
      ({ parse: parseYAML } = await import('yaml'));
    } catch (err) {
      throw new Error(
        `could not import "yaml" to parse CITATION.cff: ${String(err)}. ` +
          'This check cannot silently pass — fix the import, do not delete the assertion.',
        { cause: err },
      );
    }
    return parseYAML(read('CITATION.cff'));
  };

  it('CITATION.cff parses, and carries the fields a citation needs', async () => {
    const cff = await loadCitation();
    expect(cff['cff-version'], 'CITATION.cff declares no cff-version').toBe('1.2.0');
    expect(cff.title, 'CITATION.cff must name the entity, not the category').toBe('SafeUnfollow');
    expect(Array.isArray(cff.authors) && cff.authors.length > 0, 'no authors').toBe(true);
    expect(typeof cff.message).toBe('string');
  });

  it('CITATION.cff states the version package.json states', async () => {
    const cff = await loadCitation();
    expect(
      cff.version,
      `CITATION.cff says ${String(cff.version)}, package.json says ${PACKAGE.version}. ` +
        'A DOI minted from a release cannot be corrected — fix this before tagging.',
    ).toBe(PACKAGE.version);
  });

  it('the CHANGELOG names the version package.json names', () => {
    // The third statement of one version, and the last one to be left ungated.
    //
    // On 2026-09-08 the entity work removed the README/CITATION.cff disagreement and could
    // not close this one: a CHANGELOG entry wants the release date, and the release had not
    // happened yet. So the tree stood at package.json 1.6.0, CITATION.cff 1.6.0, and a
    // CHANGELOG whose newest released heading said 1.5.0 — in the one file whose entire job
    // is to say what shipped, hours before a Zenodo DOI would freeze it.
    //
    // Keep a Changelog puts the newest release first, so the first `## [x.y.z]` heading is
    // the released version. `[Unreleased]` carries no digits and is skipped by the pattern
    // rather than by position.
    const released = [...read('CHANGELOG.md').matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(
      match => match[1],
    );
    expect(released.length, 'CHANGELOG.md has no released version headings to read').toBeGreaterThan(0);
    expect(
      released[0],
      `CHANGELOG.md's newest release is ${released[0]}, package.json says ${PACKAGE.version}. ` +
        'Add the entry before tagging — a DOI minted from a release cannot be corrected.',
    ).toBe(PACKAGE.version);
  });

  it('docs/tech-spec.md states the package.json version', () => {
    // The published spec states its version twice: the header line and the closing line.
    const spec = read('docs/tech-spec.md');
    const stated = [
      ...spec.matchAll(/\*\*Version:\*\*\s*v?(\d+\.\d+\.\d+)/g),
      ...spec.matchAll(/reflects v(\d+\.\d+\.\d+) architecture/g),
    ].map(match => match[1]);
    expect(stated.length, 'docs/tech-spec.md states no version to compare').toBeGreaterThanOrEqual(2);
    expect(new Set(stated)).toEqual(new Set([PACKAGE.version]));
  });

  /**
   * The hero badge reads "V1.6 Optimized for …" in ten locales: a version typed into copy, the
   * one place a reader sees it, and the one no release step touches. Code derives the version
   * (`__PKG_VERSION__`); copy cannot, so this compares it. Comments are stripped from code so a
   * docblock recording an old version is not read as a claim.
   */
  it('no hand-written version string in src disagrees with package.json', () => {
    const [major, minor] = PACKAGE.version.split('.');
    const offenders: string[] = [];
    const bundles = import.meta.glob<Record<string, unknown>>('../../locales/*/*.json', {
      eager: true,
      import: 'default',
    });
    const walk = (value: unknown, where: string): void => {
      if (typeof value === 'string') {
        for (const m of value.matchAll(/\bV(\d+)\.(\d+)(?:\.\d+)?\b/g)) {
          if (m[1] !== major || m[2] !== minor) offenders.push(`${where}: ${m[0]}`);
        }
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${where}.${k}`);
      }
    };
    for (const [file, bundle] of Object.entries(bundles)) walk(bundle, file.replace(/^.*locales\//, ''));
    // Control: the badge is really scanned, so a clean result means agreement, not absence.
    expect(JSON.stringify(bundles['../../locales/en/hero.json'])).toMatch(/\bV\d+\.\d+\b/);

    const code = import.meta.glob<string>(['../../**/*.{ts,tsx}', '!../../__tests__/**'], {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    for (const [file, source] of Object.entries(code)) {
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const m of stripped.matchAll(/['"`]v?(\d+\.\d+\.\d+)['"`]/g)) {
        if (m[1] !== PACKAGE.version && /version/i.test(stripped.slice(Math.max(0, m.index! - 60), m.index!))) {
          offenders.push(`${file}: ${m[0]}`);
        }
      }
    }
    expect(Object.keys(code).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });

  it('CITATION.cff points at the same repository, site and licence as package.json', async () => {
    const cff = await loadCitation();
    expect(normalizeRepo(String(cff['repository-code']))).toBe(
      normalizeRepo(PACKAGE.repository.url),
    );
    expect(cff.url).toBe(PACKAGE.homepage);
    expect(cff.license).toBe(PACKAGE.license);
  });

  it('CITATION.cff is not dated in the future', async () => {
    const cff = await loadCitation();
    const released = String(cff['date-released']);
    expect(released, 'date-released is not an ISO date').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      released <= new Date().toISOString().slice(0, 10),
      `date-released ${released} is in the future`,
    ).toBe(true);
  });

  it('the README cites the DOI CITATION.cff declares, and cites it once', async () => {
    // Minted 2026-09-08 from the v1.6.0 release. The DOI is now the sixth statement of a
    // fact about this project that lives in more than one file — README badge, README prose
    // and CITATION.cff — and every previous one on that list disagreed with itself inside a
    // month. So it is derived here rather than compared to a literal typed into this test.
    //
    // ⛔ Only the CONCEPT DOI belongs in the tree. Zenodo mints a second, per-version DOI
    // from every release; nothing in this repository updates it, and it would be wrong from
    // the moment the next version ships while still reading as current. This assertion
    // therefore also fails if a second `type: doi` identifier appears — that is the point,
    // not a side effect.
    const cff = await loadCitation();
    const identifiers = (cff.identifiers ?? []) as Array<{ type?: string; value?: string }>;
    const dois = identifiers.filter(id => id.type === 'doi').map(id => String(id.value));

    expect(
      dois,
      `CITATION.cff declares ${dois.length} DOI identifiers (${dois.join(', ') || 'none'}); ` +
        'it must declare exactly one, the concept DOI. A per-version DOI goes stale on the ' +
        'next release while still reading as current.',
    ).toHaveLength(1);
    const doi = dois[0];
    expect(doi, 'the DOI is not a Zenodo-shaped DOI').toMatch(/^10\.\d{4,}\/[-.\w]+$/);

    // Every DOI written anywhere in the README must be that one. A badge and a prose
    // citation that disagree is the same defect as a badge and a package version that do.
    const inReadme = [...read('README.md').matchAll(/10\.\d{4,}\/zenodo\.\d+/g)].map(m => m[0]);
    expect(inReadme.length, 'README states no DOI — the badge and the citation line are gone').toBeGreaterThan(0);
    expect(
      [...new Set(inReadme)],
      `README cites ${[...new Set(inReadme)].join(', ')}; CITATION.cff declares ${doi}. ` +
        'A citation that disagrees with the record it points at is worse than none.',
    ).toEqual([doi]);
  });

  it('the LICENSE names the entity CITATION.cff names', async () => {
    const cff = await loadCitation();
    const title = String(cff.title);
    expect(
      read('LICENSE').includes(title),
      `LICENSE does not mention "${title}". It named "Unfollow Radar Contributors" until ` +
        '2026-09-08 — an entity that existed in no other file in the tree.',
    ).toBe(true);
  });

  it('the README language badge matches SUPPORTED_LANGUAGES', () => {
    // monetization-claims.test.ts already forbids a wrong language count, but its pattern is
    // /(\d+)\s+languages?/ — a number *before* the word, as prose writes it ("10 languages").
    // The badge writes it the other way round ("Languages: 10"), so that gate reads straight
    // past it. Measured 2026-09-08: the badge is right today and held by nothing.
    const badge = /!\[Languages:\s*(\d+)\]/.exec(read('README.md'));
    expect(badge, 'README has no Languages badge to check').not.toBeNull();
    expect(
      Number(badge?.[1]),
      `README says ${String(badge?.[1])} languages, src/config/languages.ts has ${SUPPORTED_LANGUAGES.length}`,
    ).toBe(SUPPORTED_LANGUAGES.length);
  });

  /**
   * Ten with the wrong ten passes a count.
   *
   * The assertion above compares the badge's number to `SUPPORTED_LANGUAGES.length` and
   * stops there. On the same `main` it was written against, the README named Hindi —
   * retired 2026-08-08 for zero measured demand — and omitted French, shipped since: ten
   * names, ten table rows, one correct count, two wrong members. A count cannot see that,
   * and this repository has now recorded six gates that held a wrong fact in place. This
   * one was mine.
   *
   * So the membership is compared, not the size. English names are derived through
   * `Intl.DisplayNames` rather than typed into a second table here: `LANGUAGE_NAMES` holds
   * the *native* names the switcher renders, and a hand-typed English map beside it would
   * be exactly the copied fact this file exists to remove.
   */
  describe('the README names the languages languages.ts supports', () => {
    const README = read('README.md');
    const english = new Intl.DisplayNames(['en'], { type: 'language' });

    /** The `## 🌍 Multilingual Support` section, so no other table's cells are read. */
    const languageSection = (): string => {
      const start = README.indexOf('## 🌍 Multilingual Support');
      expect(start, 'README has no Multilingual Support section to read').toBeGreaterThan(-1);
      const end = README.indexOf('\n## ', start + 1);
      return README.slice(start, end === -1 ? README.length : end);
    };

    const tableRows = (): RegExpMatchArray[] => {
      const rows = [...languageSection().matchAll(/^\|([^|\n]+)\|\s*([a-z]{2})\s*\|([^|\n]*)\|\s*$/gm)];
      // Guards the guard: a table whose shape changed would yield no rows, and every
      // set comparison below would then pass against an empty set.
      expect(rows.length, 'no language rows parsed out of the Multilingual section').toBe(
        SUPPORTED_LANGUAGES.length,
      );
      return rows;
    };

    it('can name a language in English', () => {
      // A control with a known answer. A Node built with small-icu returns the code
      // itself from `of('fr')`, and every comparison below would then fail as though
      // the README were wrong. If this line is red, the environment is the defect.
      expect(
        english.of('fr'),
        'Intl.DisplayNames cannot name languages in English — this Node has no full ICU',
      ).toBe('French');
    });

    it('the language table lists exactly the supported codes', () => {
      expect([...tableRows().map(row => row[2])].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    });

    it('the language table marks exactly the RTL languages', () => {
      const rtl = tableRows()
        .filter(row => row[3].includes('\u2705'))
        .map(row => row[2]);
      expect(rtl.sort()).toEqual([...RTL_LANGUAGES].sort());
    });

    it('the feature bullet names exactly the supported languages', () => {
      const bullet = /\*\*\d+ languages?\*\*\s*[—-]\s*([^\n]+)/.exec(README);
      expect(bullet, 'README has no "N languages — ..." bullet to check').not.toBeNull();
      const named = String(bullet?.[1])
        .split(',')
        .map(name => name.replace(/\([^)]*\)/g, '').trim())
        .filter(Boolean);
      expect(named.sort()).toEqual(SUPPORTED_LANGUAGES.map(code => english.of(code)).sort());
    });
  });

  it('the README badge derives the version instead of restating it', () => {
    // Guards the class, not the one literal: any hardcoded semver in a shields *badge*
    // path is a copy that will rot. The dynamic endpoint reads package.json itself.
    const badges = read('README.md').match(/img\.shields\.io\/badge\/[^)\s]*/g) ?? [];
    const hardcoded = badges.filter(badge => /\d+\.\d+\.\d+/.test(badge));
    expect(
      hardcoded,
      'a version is hardcoded into a README badge — use ' +
        'https://img.shields.io/github/package-json/v/<owner>/<repo> so it reads package.json',
    ).toEqual([]);
  });
});

/**
 * `.zenodo.json` is the metadata Zenodo mints each release from, and when it exists Zenodo ignores
 * CITATION.cff entirely. v1.6.0's extra metadata was typed into Zenodo's form by hand and v1.7.0
 * did not inherit it, because every version is built from the repository, not from the last one.
 * So the extras live in `.zenodo.json` now, and the facts both files state must agree, or the
 * archive (which cannot be rewritten) and the citation GitHub shows tell two stories.
 */
describe('.zenodo.json agrees with CITATION.cff', () => {
  const ZENODO = JSON.parse(read('.zenodo.json')) as {
    title: string;
    description: string;
    license: string;
    keywords: string[];
    creators: Array<{ name: string; orcid?: string }>;
    related_identifiers: Array<{ identifier: string; relation: string }>;
  };

  const loadCitation = async (): Promise<Record<string, unknown>> => {
    const { parse } = await import('yaml');
    return parse(read('CITATION.cff')) as Record<string, unknown>;
  };

  it('states the same title, abstract, licence and keywords', async () => {
    const cff = await loadCitation();
    expect(ZENODO.title).toBe(cff.title);
    expect(ZENODO.description).toBe(cff.abstract);
    expect(ZENODO.license).toBe(cff.license);
    expect(ZENODO.keywords).toEqual(cff.keywords);
  });

  it('names the same authors', async () => {
    const authors = (await loadCitation()).authors as Array<Record<string, string>>;
    expect(ZENODO.creators.map(c => c.name)).toEqual(
      authors.map(a => `${a['family-names']}, ${a['given-names']}`),
    );
  });

  it('carries the same ORCID, and the site names it on the founder', async () => {
    const authors = (await loadCitation()).authors as Array<Record<string, string>>;
    // CFF wants the full URL, Zenodo the bare iD.
    expect(ZENODO.creators.map(c => c.orcid)).toEqual(
      authors.map(a => a.orcid?.replace('https://orcid.org/', '')),
    );
    for (const a of authors) {
      expect(read('src/components/OrganizationSchema.tsx')).toContain(`'${a.orcid}'`);
      expect(read('docs/_config.yml')).toContain(`"${a.orcid}"`);
    }
  });

  it('links only profiles the site itself claims in sameAs', () => {
    const schema = read('src/components/OrganizationSchema.tsx');
    const profiles = ZENODO.related_identifiers
      .map(r => r.identifier)
      .filter(url => !url.startsWith('https://safeunfollow.app'));
    // Control: the filter leaves something to check.
    expect(profiles.length).toBeGreaterThan(0);
    for (const url of profiles) expect(schema, url).toContain(`'${url}'`);
  });

  it('carries no version, so the release tag stays the only source of one', () => {
    expect(ZENODO).not.toHaveProperty('version');
  });
});
