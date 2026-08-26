import { describe, expect, it } from 'vitest';
import EN from '../../fixtures/instagram-html/following.en.html?raw';
import ES from '../../fixtures/instagram-html/following.es.html?raw';
import JA from '../../fixtures/instagram-html/following.ja.html?raw';
import { transcodeRelationshipHtml } from '@/core/parsers/instagram-html';
import { resolveEntries, resolveEntryList } from '@/core/parsers/instagram-utils';

/**
 * The same account's `following.html`, exported three times minutes apart in
 * three languages, on 2026-08-25.
 *
 * This is the controlled experiment the whole "locale invariance" obligation
 * rests on, and it is the most valuable fixture material this project holds:
 * the only variable between these three files is Meta's UI language. Full-file
 * check when the extracts were cut — **393 records in each, in the same order,
 * with the same set of accounts.**
 *
 * Japanese was chosen as the third deliberately rather than for coverage. It is
 * the sharpest available test because it shares no alphabet, no month naming
 * convention, and no date field order with the other two — conventionally it
 * writes year first — so anything the parser reads that a translator can touch
 * fails here and nowhere else.
 *
 * What IS localised, verified across these three: the `<h1>`
 * (`Following` / `Seguidos` / `フォロー中`), the month token
 * (`Aug` / `ago` / `8月`), the meridiem's case, and the header `<time>`'s
 * rendered text. What is NOT: every class name, every href, and the per-row
 * date's field order.
 */
const usernames = (html: string): string[] =>
  resolveEntries(
    resolveEntryList(transcodeRelationshipHtml(html), ['relationships_following']) ?? []
  )
    .items.map(i => i.username)
    .sort();

describe('one account, one day, three UI languages', () => {
  it('reads the same accounts out of the English and Spanish exports', () => {
    expect(usernames(ES)).toEqual(usernames(EN));
  });

  it('reads the same accounts out of the English and Japanese exports', () => {
    // The one that would catch a parser reading a heading, a label, or a
    // spelled-out word. `<h1>` here is `フォロー中` and the date reads
    // `8月 10, 2026 6:32 PM`.
    expect(usernames(JA)).toEqual(usernames(EN));
  });

  it('finds every record in all three, not merely the same ones', () => {
    // Set equality alone would pass if the parser read zero records from all
    // three. The count is what makes the equality mean something.
    expect(usernames(EN)).toHaveLength(20);
    expect(usernames(ES)).toHaveLength(20);
    expect(usernames(JA)).toHaveLength(20);
  });
});

describe('the meridiem is not lowercase, whatever a forensics pass concluded', () => {
  it('is uppercase in Japanese and lowercase in English and Spanish', () => {
    // Pinned as a fixture property rather than as parser behaviour, because it
    // is the premise the date parser has not been written against yet.
    //
    // A published invariant said "am/pm always lowercase ASCII, regardless of
    // locale, zero exceptions" — drawn from four samples and false of the
    // fifth. Japanese writes `AM`/`PM` uppercase, so a case-sensitive
    // `(am|pm)` fails on 100% of Japanese rows. Nothing reads the meridiem
    // today; this test exists so that when something does, the assumption is
    // already contradicted in the suite rather than in production.
    expect(JA).toContain('2026 6:32 PM');
    expect(EN).toContain('2026 6:32 pm');
    expect(ES).toContain('2026 6:32 pm');
  });

  it('carries a different month token in each language', () => {
    // The reason a CLDR-short table is not enough on its own: Meta writes
    // Spanish September as `sep` where `Intl.DateTimeFormat('es')` gives
    // `sept`. The month table has to be fitted to the file's own tokens.
    expect(EN).toContain('Aug 10, 2026');
    expect(ES).toContain('ago 10, 2026');
    expect(JA).toContain('8月 10, 2026');
  });
});
