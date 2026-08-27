import { describe, expect, it } from 'vitest';
import { fitMonthTable, readRowDate, splitRowDate } from '@/core/parsers/instagram-html-dates';

/**
 * Reading the per-record date out of an HTML export.
 *
 * The date is localised human text — `Aug 10, 2026 6:32 pm`, `ago 10, 2026 6:32
 * pm`, `8月 10, 2026 6:32 PM` — and there is no machine form anywhere in the
 * document: zero `data-*`, zero `title=`, and the single `<time datetime>` in
 * the header is the file's generation time, not a row's.
 *
 * So the month has to be read from a word, and the obvious ways to do that are
 * both measurably wrong:
 *
 * - A CLDR-short table misses Spanish. Meta writes September `sep`;
 *   `Intl.DateTimeFormat('es', { month: 'short' })` gives `sept` for `es`,
 *   `es-ES` and `es-419` alike. The miss is silent, because an unparsed date
 *   becomes 0 and the oldest-timestamp statistic skips zeros.
 * - "Truncate the full month name to three characters" reproduces both Spanish
 *   and English exactly, and then collapses elsewhere: `fr` juin/juillet and
 *   `cs` červen/červenec and `el` Ιουνίου/Ιουλίου all collide at three, and
 *   `vi` collapses all twelve to `thá`.
 *
 * Neither is a rule we hold ground truth for. So the table is FITTED to the
 * tokens the file actually contains, and the locale never has to be known.
 */

describe('splitting one row date into its parts', () => {
  it('reads the English shape', () => {
    expect(splitRowDate('Aug 10, 2026 6:32 pm')).toEqual({
      monthToken: 'Aug',
      day: 10,
      year: 2026,
      hour: 6,
      minute: 32,
      meridiem: 'pm',
    });
  });

  it('reads the Spanish shape, whose month token is not CLDR', () => {
    expect(splitRowDate('ago 10, 2026 6:32 pm')?.monthToken).toBe('ago');
  });

  it('reads the Japanese shape, which shares no alphabet and no month naming', () => {
    // Field ORDER is locale-invariant even here, which is the non-obvious part:
    // Japanese conventionally writes year first, and Meta does not.
    expect(splitRowDate('8月 10, 2026 6:32 PM')).toEqual({
      monthToken: '8月',
      day: 10,
      year: 2026,
      hour: 6,
      minute: 32,
      meridiem: 'PM',
    });
  });

  it('returns null rather than a partial reading when the shape is unfamiliar', () => {
    expect(splitRowDate('2026-08-10T18:32Z')).toBeNull();
    expect(splitRowDate('')).toBeNull();
    expect(splitRowDate('sometime last year')).toBeNull();
  });
});

describe('fitting a month table to the tokens a file actually contains', () => {
  it('fits English', () => {
    const table = fitMonthTable(['Aug', 'Jul', 'Jan', 'Dec']);
    expect(table?.get('Jan')).toBe(0);
    expect(table?.get('Jul')).toBe(6);
    expect(table?.get('Aug')).toBe(7);
    expect(table?.get('Dec')).toBe(11);
  });

  it('fits Spanish `sep`, which no CLDR table contains', () => {
    // The single most valuable case in this file: `sep` is what Meta writes and
    // `sept` is what Intl returns, so a table chosen by locale rather than
    // fitted to the data misses roughly 5% of a Spanish export's rows in
    // silence.
    const table = fitMonthTable(['ago', 'sep', 'ene', 'dic']);
    expect(table?.get('ene')).toBe(0);
    expect(table?.get('sep')).toBe(8);
    expect(table?.get('dic')).toBe(11);
  });

  it('fits Japanese without a CJK branch', () => {
    // `(ja, cldr-short)` already fits injectively. A hand-written CJK branch
    // would reintroduce exactly the per-locale table this design exists to
    // avoid, written against the one CJK locale we happen to hold.
    const table = fitMonthTable(['8月', '1月', '12月']);
    expect(table?.get('1月')).toBe(0);
    expect(table?.get('8月')).toBe(7);
    expect(table?.get('12月')).toBe(11);
  });

  it('is not fooled by the machine timezone', () => {
    // The trap: `Intl.DateTimeFormat(locale, {month:'short'})` over
    // `Date.UTC(y, i, 1)` builds a table shifted by one whenever the machine's
    // offset is negative — at UTC−3, asking for August returns `Tháng 7`.
    //
    // Closed structurally rather than by hoping this test runs somewhere it
    // would fail: the probe date is mid-month, so no offset on Earth can carry
    // it across a month boundary. This assertion would catch a regression only
    // on a negative-offset machine, which is why it is not the defence.
    const table = fitMonthTable(['Jan', 'Dec']);
    expect(table?.get('Jan')).toBe(0);
    expect(table?.get('Dec')).toBe(11);
  });

  it('refuses when no candidate covers every token', () => {
    // Honest failure. A token nobody recognises means the format moved, and
    // guessing the rest of the table from the tokens that did match would date
    // some rows and silently zero others — the worst of both.
    expect(fitMonthTable(['Aug', 'Qux'])).toBeNull();
  });

  it('refuses a token set that no single language explains', () => {
    // Months from two languages in one file is not a thing Meta does, so it is
    // a signal that something upstream is wrong rather than an input to
    // interpret generously.
    expect(fitMonthTable(['Aug', 'ago', '8月'])).toBeNull();
  });

  it('refuses an empty token set rather than inventing a table', () => {
    expect(fitMonthTable([])).toBeNull();
  });
});

describe('turning a row into an instant', () => {
  const table = fitMonthTable(['Aug', 'Jan', 'Dec']);

  /**
   * `readRowDate` takes the already-split parts, because every caller has split
   * the row before it gets there. These cases are all well-formed rows, so a
   * failed split is a broken test rather than a case under test — it throws
   * here instead of collapsing into the `undefined` the assertions look for.
   */
  const read = (text: string, months: Map<string, number> | null) => {
    const parts = splitRowDate(text);
    if (parts === null) throw new Error(`test row is not a row date: ${text}`);
    return readRowDate(parts, months);
  };

  it('reads a full row', () => {
    // Seconds, not milliseconds — `RawItem.timestamp` is what the JSON export
    // carries and that is epoch seconds.
    const ts = read('Aug 10, 2026 6:32 pm', table);
    expect(ts).toBe(Date.UTC(2026, 7, 10, 18, 32) / 1000);
  });

  it('reads a morning row', () => {
    expect(read('Aug 10, 2026 6:32 am', table)).toBe(Date.UTC(2026, 7, 10, 6, 32) / 1000);
  });

  it('reads midnight and noon the way the 12-hour clock means them', () => {
    expect(read('Jan 01, 2026 12:00 am', table)).toBe(Date.UTC(2026, 0, 1, 0, 0) / 1000);
    expect(read('Jan 01, 2026 12:00 pm', table)).toBe(Date.UTC(2026, 0, 1, 12, 0) / 1000);
  });

  it('accepts an uppercase meridiem, because Japanese writes one', () => {
    // A published forensics conclusion said "am/pm always lowercase ASCII,
    // regardless of locale, zero exceptions across 9 file-types × 4 samples".
    // Japanese writes `AM`/`PM`: 401 and 400 of its 801 rows. The claim was
    // true of the four samples it was drawn from and false of the fifth, so a
    // case-sensitive `(am|pm)` fails on 100% of Japanese rows.
    expect(read('Aug 10, 2026 6:32 PM', table)).toBe(read('Aug 10, 2026 6:32 pm', table));
  });

  it('gives up on a row whose month is not in the table', () => {
    expect(read('Mai 10, 2026 6:32 pm', table)).toBeUndefined();
  });

  it('gives up on every row when there is no table at all', () => {
    expect(read('Aug 10, 2026 6:32 pm', null)).toBeUndefined();
  });
});
