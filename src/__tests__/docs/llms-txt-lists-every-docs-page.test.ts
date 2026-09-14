import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { docsPaths } from '../../../scripts/docs-paths';

/**
 * `public/llms.txt` is what `docs/_config.yml` routes AI engines to, and it carried a hand-typed
 * copy of the same URL set the sitemap carries. GH#246 replaced the sitemap's copy with a
 * derivation; this one stayed hand-typed and had drifted to 10 of 14 pages (GH#248).
 *
 * ⛔ The drift was NOT staleness, and that is why a gate is the right answer rather than a
 * one-off edit. `llms.txt`'s last edit postdates every page it omitted, so the omission was made
 * with all four present — it is equally consistent with a curation decision and with an oversight,
 * and nothing in the repository could tell them apart. So this suite does not demand that every
 * page be listed. It demands that every page be either listed or **named as excluded in the file
 * itself**, which makes a deliberate omission a recorded decision and leaves an accidental one
 * with nowhere to hide.
 *
 * Why this is not the sitemap's suite over again: that one asserts a built artefact and needs a
 * `dist/`, so it is gated and does not run in two of the three CI workflows. `llms.txt` is a
 * source file, so this runs everywhere, unconditionally.
 *
 * The comparison fails in both directions. A missing page is invisible to an engine that reads
 * this file; a listed URL no source declares advertises a 404 to that same engine, which is worse
 * than the omission because it looks real.
 */
const BASE_URL = 'https://safeunfollow.app';

/** A docs URL written as a link — the form the listing uses. */
const LISTED = /https:\/\/safeunfollow\.app(\/docs[^)\s]*)/g;
/** A bare path on its own bullet — the form an exclusion uses, so the two cannot be confused. */
const EXCLUDED = /^-\s+(\/docs\S*)/gm;
/** Deleting this heading would delete the mechanism, so its absence is a failure, not an empty set. */
const COMPLETENESS = '\n## Completeness\n';

const llms = readFileSync(resolve(__dirname, '../../../public/llms.txt'), 'utf-8');
const declared = docsPaths(resolve(__dirname, '../../../docs'));

const completenessAt = llms.indexOf(COMPLETENESS);
const listed = [...llms.matchAll(LISTED)].map(match => match[1]!);
const excluded =
  completenessAt === -1 ? [] : [...llms.slice(completenessAt).matchAll(EXCLUDED)].map(m => m[1]!);

describe('llms.txt accounts for every docs page the sources declare', () => {
  it('reads a docs tree with pages in it', () => {
    // Guards the guard: against an empty docs tree the equality below would hold only if the file
    // were also empty of docs links, and both readings of "nothing" would pass as agreement.
    expect(declared.length).toBeGreaterThan(10);
  });

  it('reads an llms.txt with docs links in it', () => {
    expect(listed.length).toBeGreaterThan(5);
  });

  it('still carries the section an exclusion would be recorded in', () => {
    expect(completenessAt).toBeGreaterThan(-1);
  });

  it('accounts for each declared page exactly once, as listed or as excluded', () => {
    expect([...listed, ...excluded].sort()).toEqual([...declared].sort());
  });

  it('never both lists and excludes the same page', () => {
    expect(listed.filter(path => excluded.includes(path))).toEqual([]);
  });
});
