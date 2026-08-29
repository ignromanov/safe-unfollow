import { describe, expect, it } from 'vitest';
import FOLLOWING_HTML from '../../fixtures/instagram-html/following.html?raw';
import FOLLOWING_ES from '../../fixtures/instagram-html/following.es.html?raw';
import FOLLOWING_JA from '../../fixtures/instagram-html/following.ja.html?raw';
import FOLLOWING_JSON from '../../fixtures/instagram-html/following.json?raw';
import { combineDatesFitted, parseRelationshipFile } from '@/core/parsers/instagram-html';

/**
 * GH#156, the blocked half. `relationshipSkewVerdict`'s `insufficient-data`
 * has at least three causes and only one of them — a month-name table that
 * failed to fit — is locale-driven. `parseRelationshipFile` is the one place
 * that still has both the file's records and the fitted table in scope, so it
 * is where the fact has to leave the transcoder.
 */
describe('parseRelationshipFile reports whether an HTML file dated itself', () => {
  it('fits a real export whose month table resolves cleanly', () => {
    const result = parseRelationshipFile('following.html', FOLLOWING_HTML);
    expect(result.datesFitted).toBe(true);
  });

  it('fits the Spanish and Japanese twins the same way (locale invariance)', () => {
    // `following.es.html` needs `prefix3` (Meta's `sep` is not a CLDR table
    // entry) and `following.ja.html` needs `cldr-short` — both resolve, per
    // `instagram-html-dates.ts`'s own header. Neither should read as a
    // failure just because the shape of the fit differed.
    expect(parseRelationshipFile('following.html', FOLLOWING_ES).datesFitted).toBe(true);
    expect(parseRelationshipFile('following.html', FOLLOWING_JA).datesFitted).toBe(true);
  });

  it('reports false when real date text is present but no table explains it', () => {
    // Every `Aug` token replaced with one no candidate table produces: the
    // file still carries real dates (`Apr`, `Jul`, `Jun`, `May` survive
    // untouched), so this is the locale-driven failure the field exists to
    // catch, not an absence of evidence. `fitMonthTable` is all-or-nothing per
    // file — one unexplained token loses the whole table — so this is enough
    // to fail the fit, the same way `['Aug', 'Qux']` does in
    // `instagram-html-dates.test.ts`.
    const unfittable = FOLLOWING_HTML.split('Aug ').join('Zzq ');

    const result = parseRelationshipFile('following.html', unfittable);
    expect(result.datesFitted).toBe(false);
    // And the file is still read — GH#156 must not turn a locale it cannot
    // date into a file it cannot read at all.
    expect(result.data).not.toBeNull();
  });

  it('omits the fact for a JSON file — the question does not apply', () => {
    const result = parseRelationshipFile('following.json', FOLLOWING_JSON);
    expect(result.datesFitted).toBeUndefined();
  });

  it('omits the fact for an HTML file it could not read at all', () => {
    // The wrapper class renamed: no records are ever collected, so there is no
    // evidence to report either way — `undefined`, not `false`. A caller that
    // read `false` here would count an unreadable file as a locale failure.
    const gutted = FOLLOWING_HTML.split('uiBoxWhite').join('uiBoxSomethingElse');

    const result = parseRelationshipFile('following.html', gutted);
    expect(result.data).toBeNull();
    expect(result.datesFitted).toBeUndefined();
  });
});

describe('combineDatesFitted', () => {
  it('is undefined when nothing had a date to fit', () => {
    expect(combineDatesFitted([undefined, undefined])).toBeUndefined();
    expect(combineDatesFitted([])).toBeUndefined();
  });

  it('is true when every file with evidence fitted', () => {
    expect(combineDatesFitted([true, undefined, true])).toBe(true);
  });

  it('is false as soon as one file failed to fit, whatever its siblings say', () => {
    expect(combineDatesFitted([true, false, undefined])).toBe(false);
    expect(combineDatesFitted([false])).toBe(false);
  });
});
