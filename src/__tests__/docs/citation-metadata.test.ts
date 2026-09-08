import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

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
