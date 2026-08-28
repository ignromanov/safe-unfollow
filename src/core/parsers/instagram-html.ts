/**
 * Turns one relationship file's HTML into the shape its JSON twin would have.
 *
 * Meta's export dialog offers HTML or JSON, and roughly a fifth of the people
 * who reach this tool pick HTML. Today they are refused: `upload_error_html_format`
 * is 53.4% of all upload errors and 60.2% of the sessions that hit it never
 * succeed at all — measured over the 30 days to 2026-08-25. Nothing about the
 * archive is unreadable: it holds the same people, in the same order, with the
 * same dates, written in different markup.
 *
 * ⚠️ **That share is an UPPER BOUND on "picked the wrong format", not a count
 * of it.** `createCriticalError` tested the format before asking whether the
 * archive was an Instagram export at all, so every ZIP of `.html` — any
 * website, any unrelated download — landed in the same bucket. Fixed on this
 * branch, but every number derived from the bucket inherits the contamination,
 * and it cannot be sized after the fact: no dimension in the database separates
 * the two populations. Other documents quote 55.2% and 48% for neighbouring
 * windows; none of the three is a floor.
 *
 * So this is an adapter, not a second pipeline. The format difference lives on
 * exactly one stretch — bytes to records — and everything downstream
 * (`resolveEntry`, `instagram-labels.ts`, the badge set algebra, the skew
 * detector, IndexedDB) is already format-agnostic. The contract is therefore
 * narrow on purpose: given one file's HTML text, return what `JSON.parse`
 * would have returned for that file's JSON twin, and change nothing else.
 *
 * ## Why a parser library rather than a regex
 *
 * `DOMParser` is unavailable in a Web Worker in every browser — `document` does
 * not exist in `DedicatedWorkerGlobalScope`, so the `createHTMLDocument()`
 * fallback fails too, and `HTMLDocument` is not structured-cloneable, so
 * parsing on the main thread and posting the result across does not work
 * either. `whatwg/dom#1217` has been open since July 2023 with no
 * implementation. A library is not a preference here, it is the only route.
 *
 * `htmlparser2`'s streaming `Parser` costs 28.1 KB gzip for the imports used
 * here, measured with esbuild `--bundle --minify`, and it sits inside the
 * lazily-loaded parse worker rather than on any critical path. The regex
 * alternative was rejected on correctness rather than size: the export's
 * record wrapper nests, regex cannot count, and nested quantifiers over a
 * genuinely nested template are a catastrophic-backtracking risk that would
 * hang the worker on a real file.
 *
 * ## What it keys on, and why that choice is the whole design
 *
 * Two record grammars ship in the two REQUIRED files:
 *
 * - `following.html` — an `<h2>` holding the username, and an anchor to
 *   `instagram.com/_u/NAME`.
 * - `followers_1.html` — no `<h2>` at all, and an anchor to
 *   `instagram.com/NAME` whose text is the username.
 *
 * Keyed on the anchor's `href`, those are one grammar and this file needs no
 * branch. Keyed on the anchor's text, or on the file's name, or on whether an
 * `<h2>` is present, they are two — and a per-file branch is exactly where the
 * next file Meta adds returns zero records in silence. Verified against a real
 * pair: `following` 413 = 413 and `followers_1` 364 = 364 against their JSON
 * twins, symmetric difference 0 in both.
 *
 * A third grammar ships in the SIX optional files — six, not seven: count the
 * specs in `instagram-file-specs.ts`, which is where that number is decided. A
 * `<table>` of label/value rows — `Name`, `Username`, and `URL` when the
 * account has a bio link — with the date in a trailing div.
 *
 * The property the reader depends on, measured across the whole 2026-08-11
 * export: the two required files hold profile anchors and **zero tables**, the
 * optional files hold tables and **zero profile anchors**. The two never mix,
 * so the reader tries the anchor and falls back to the table rather than
 * choosing between them.
 *
 * A per-file table count used to stand here, and it listed four numbers for six
 * files. It is not restored, corrected: the archives it counts are gitignored,
 * so nobody reading this can recompute it, and a number in that position goes
 * stale without ever looking wrong. The invariant above is what the code rests
 * on, and `instagram-html-optional.test.ts` executes it.
 *
 * That table is not a model to invent a reader for: it is the `label_values`
 * shape the 2026-08 JSON export already carries, rendered as markup — same
 * labels, same values, same order — so a transcoded record is read by
 * `resolveEntry`'s third shape and its localised username label is resolved by
 * `instagram-labels.ts`, both unchanged.
 *
 * Reading it is a correctness stake rather than completeness.
 * `pending_follow_requests` and `recent_follow_requests` are SUBTRACTED from
 * `following` to compute `notFollowingBack` (`core/badges/index.ts`), and both
 * are grammar C. A reader that returned nothing from them would not empty a
 * badge, it would inflate the app's most-used one — and in silence, if an
 * unread file and an empty one were the same empty array, because
 * `followRequestsUnreadable` (GH#41) is raised by the first and not the second.
 *
 * They are not the same value here, and making them different is what the
 * `null` below is for. They WERE the same until 2026-08-28, which is how this
 * module came to carry that risk in its own header while shipping it.
 *
 * Nothing here reads a class name that could be localised, a heading, a label,
 * or a file name. The class names ARE stable — byte-identical across five
 * months and three locales — but the record model behind them is not: Meta
 * changed the optional files from a flat anchor to a label table between
 * 2026-03 and 2026-08 while leaving every class name alone. So the wrapper
 * class is used to find record boundaries and the href is used to read the
 * record, and a change to either produces zero records rather than a partial
 * read presented as a whole one.
 *
 * ## Why an unreadable file is `null` and not an empty list
 *
 * Both grammars leave exactly one outermost record wrapper per record and NONE
 * when there are no records — measured: grammar C nests wrappers at div depths
 * 3 and 5, N at each for N records, with no outer collection wrapper to survive
 * an empty list. So a file whose wrapper class changed and a file belonging to
 * a user with no close friends produce the same markup as far as this reader is
 * concerned, and NOTHING downstream can tell them apart: the layer above knows
 * only that the file was found, not that it was read.
 *
 * This module returned `[]` for both until 2026-08-28, and the difference is
 * the whole GH#41 failure it was written to prevent — a renamed wrapper class
 * in `pending_follow_requests.html` came back as "you have no pending
 * requests", `followRequestsUnreadable` stayed false, and `notFollowingBack`
 * silently absorbed every request the file held. Meanwhile the JSON path
 * reports the same drift as `INVALID_*_FORMAT`, so this reader was strictly the
 * weaker of the two on exactly the case it names as its reason to exist.
 *
 * So the answer is `resolveEntryList`'s, whose contract this one now matches
 * word for word: `null` means "shape not recognized", an empty array means
 * "shape recognized, genuinely no records", and the two must never collapse
 * into one value. A document HTML gives us no way to recognize positively is
 * unreadable, and that includes the genuinely-empty list. The cost of being
 * wrong in this direction is a drift warning on a file that held nothing; the
 * cost of being wrong in the other is a wrong number with no warning at all.
 */

import { Parser } from 'htmlparser2';
import {
  fitMonthTable,
  readRowDate,
  splitRowDate,
  type RowDateParts,
} from './instagram-html-dates';

/**
 * Read one relationship file's text into records, whatever markup it is in.
 *
 * The single place the two formats meet, and it decides per FILE rather than
 * per archive: the entry's own extension is a fact, `analysis.format` is an
 * aggregate over the whole ZIP. A half-merged archive therefore reads each file
 * the way that file is actually written, and no caller has to be told which
 * format it is holding.
 *
 * It lives in this module rather than beside the file names in
 * `instagram-file-specs.ts` for a bundle reason, not an aesthetic one:
 * `useFileUpload.ts` imports `OPTIONAL_FILE_DRIFT_CODES` from that module, so
 * anything it reaches is main-bundle code, and this reaches htmlparser2. Here it
 * stays inside the lazily-loaded parse worker.
 *
 * @param name the entry's path in the archive, used only for its extension.
 * @throws whatever `JSON.parse` throws for malformed JSON. The HTML side does
 *   not throw — an unreadable document yields `null`, which is the same
 *   "shape not recognized" value `resolveEntryList` returns for unreadable
 *   JSON, and reaches the same `INVALID_*_FORMAT` / drift reporting.
 */
export function parseRelationshipFile(name: string, text: string): unknown {
  return /\.html$/i.test(name) ? transcodeRelationshipHtml(text) : JSON.parse(text);
}

/**
 * The wrapper every record sits in, in every file, in every sample held.
 *
 * Matched as a whitespace-delimited class rather than a substring, so that a
 * future `uiBoxWhiteSomething` cannot be mistaken for it — and as a regex
 * rather than `split(/\s+/).includes(...)`, which allocated an array per
 * record to look for one constant string. At the 1M-account scale this parser
 * is built for that is a million allocations to answer a question a test
 * answers without any.
 */
const RECORD_CLASS = /(?:^|\s)uiBoxWhite(?:\s|$)/;

/**
 * An Instagram profile link, and nothing else.
 *
 * The `_u/` segment is optional because `following.html` writes it and
 * `followers_1.html` does not — that difference is the only thing separating
 * the two grammars, and absorbing it here is what removes the branch.
 *
 * Anchored at both ends deliberately. A record may carry an arbitrary link the
 * account put in its bio — in one real `removed_suggestions.html` it is a
 * WhatsApp shortlink — and a loose match would turn that into an account that
 * does not exist.
 */
const PROFILE_HREF = /^https:\/\/www\.instagram\.com\/(?:_u\/)?([^/?#]+)\/?$/;

/** One anchor record, in the shape `resolveEntry` already reads from JSON. */
interface TranscodedEntry {
  title: string;
  string_list_data: [{ href: string; timestamp?: number }];
}

/**
 * One table record, in the `label_values` shape `resolveEntry` reads third.
 *
 * No `href`, deliberately, and the omission mirrors the JSON reader rather than
 * being a gap in this one: the `URL` label holds whatever the account put in its
 * bio — in one real `removed_suggestions` it is a WhatsApp shortlink — so
 * carrying it as a profile link would aim a click off Instagram entirely.
 */
interface TranscodedLabelEntry {
  label_values: { label: string; value: string }[];
  timestamp?: number;
}

/** A record as read from the markup, before the file's month table is known. */
interface RawRecord {
  /**
   * Grammar A/B: the profile anchor. One field rather than two, because the
   * handle and the href are read from the same match and are never separately
   * present — a pair of nullable siblings would let a state exist that the
   * markup cannot produce, and would have to be null-checked twice downstream
   * to prove it does not.
   */
  profile: { username: string; href: string } | null;
  /** Grammar C: the record's label/value rows, in document order. */
  labelValues: { label: string; value: string }[];
  /**
   * The row date already split. Stored parsed rather than as text because
   * deciding a string IS a date is the same act as reading it: keeping the raw
   * text made `splitRowDate` run three times per dated record, and let the two
   * readings drift apart across two modules.
   */
  date: RowDateParts | null;
}

/**
 * Read one relationship file's records.
 *
 * Returns a bare array, which `resolveEntryList` accepts for both
 * `following.json` and `followers_*.json` — so the caller does not have to say
 * which file this was, and this function does not have to know. That is the
 * same no-branch property the href anchor buys, one layer up.
 *
 * @param html one file's full text, as `zip.js` hands it back decoded.
 * @returns the file's entries, or `null` when the document could not be
 *   recognized as a relationship file at all — see the module header for why
 *   that is not an empty array.
 */
export function transcodeRelationshipHtml(html: string): unknown[] | null {
  const records = readRecords(html);
  if (records === null) return null;

  // Two passes, and the second cannot be folded into the first: the month table
  // is fitted to the tokens of the WHOLE file, so no row can be dated until
  // every row has been seen. That is the point of fitting rather than choosing
  // — a per-row guess is exactly what a table nobody chose protects against.
  //
  // A Set rather than an array, because there are at most twelve distinct month
  // tokens however many records the file holds. `fitMonthTable` deduplicates
  // anyway, so an array only decided WHERE the dedup happened — and a
  // 1M-account `following.html` would have materialised a million strings to
  // reach the same twelve.
  const tokens = new Set<string>();
  for (const { date } of records) {
    if (date !== null) tokens.add(date.monthToken);
  }
  const monthTable = fitMonthTable(tokens);

  return records.map(({ profile, labelValues, date }) => {
    const timestamp = date === null ? undefined : readRowDate(date, monthTable);

    // The anchor grammar first, because it is the one the two required files
    // use and the one whose `href` is worth keeping. A record never carries
    // both — measured, the anchor files hold zero tables and the table files
    // zero anchors — so the order is a preference, not a tiebreak.
    if (profile !== null) {
      // Omitted rather than zeroed when unreadable. `resolveEntry` reads
      // `item?.timestamp` and the parsers store `?? 0`, so the zero is applied
      // one layer down where it already means "Instagram gave no date" —
      // writing it here would make an unreadable date indistinguishable from an
      // absent one at the only layer that can still tell them apart.
      const entry: TranscodedEntry = {
        title: profile.username,
        string_list_data: [{ href: profile.href }],
      };
      if (timestamp !== undefined) entry.string_list_data[0].timestamp = timestamp;
      return entry;
    }

    const entry: TranscodedLabelEntry = { label_values: labelValues };
    if (timestamp !== undefined) entry.timestamp = timestamp;
    return entry;
  });
}

/**
 * The markup pass: every record's username, profile link and raw date text.
 *
 * Separated from dating so that "what the file says" and "what that means" stay
 * apart — the first is a fact about the bytes, the second depends on a table
 * fitted across all of them.
 *
 * @returns the records, or `null` when the document is not one this reader
 *   recognizes. Three things make it unrecognizable, and all three are answered
 *   the same way, because each produces a number nobody can check:
 *
 *   1. **The document did not close its own tags.** A truncated download or an
 *      unclosed `<div>` makes every following record nest inside the first, and
 *      htmlparser2 closes them all in one burst at EOF: N accounts arrive as
 *      ONE record, with nothing counted as unresolved. Measured on all four
 *      real fixtures, a well-formed export closes nothing during `end()`, so
 *      "a tag closed after the input ran out" is a truncation signal that costs
 *      one boolean and depends on no class name.
 *   2. **No tag at all.** Not a markup document — JSON bytes in a `.html`
 *      entry, or an empty file.
 *   3. **Markup, no wrappers, but record payload lying outside every wrapper.**
 *      The wrapper class moved out from under records that are still in the
 *      file. A profile anchor or a `<table>` at wrapper depth 0 is that
 *      evidence, and it is the only thing separating this case from a list that
 *      is genuinely empty, which returns `[]` and must keep doing so — a user
 *      with no close friends is not a drifted export.
 */
function readRecords(html: string): RawRecord[] | null {
  const records: RawRecord[] = [];

  // Depth of `<div>` nesting inside the record currently open; 0 means none is.
  // Counted rather than matched on the closing tag, because the close carries
  // no class and the wrapper legitimately contains further divs.
  let depth = 0;
  let profile: { username: string; href: string } | null = null;
  let date: RowDateParts | null = null;

  // The text of the element currently open, and one frame per ancestor still
  // open inside the record. A stack rather than a single string because the
  // single string was reset by EVERY open tag, so it never held more than the
  // innermost element's own text: `<td><span>alice</span></td>` read as an
  // empty value, and the comment below claiming accumulation "across an
  // element" was true only when the element had no children. Meta wrapping one
  // value in a `<span>` is a template change it has made before, and would have
  // turned every optional file into drift.
  //
  // A parent inherits its children's text, so every element is tested against
  // the date shape with its full contents — and the innermost element holding
  // exactly a date still closes first, so it is still the one that matches.
  let text = '';
  const ancestors: string[] = [];

  // Depth of `<table>` nesting, used only to keep grammar C's anchors out of
  // the grammar A/B reading below.
  let tables = 0;

  // Whether the document is markup at all, and whether it holds record payload
  // that belongs to no wrapper. Together these separate the three ways a file
  // can yield no records — see this function's `@returns`.
  let tagsSeen = 0;
  let orphanPayload = false;

  // Set between the last `write` and `end`, so that a close tag arriving after
  // the input ran out can be told from one the document actually contained.
  let inputEnded = false;
  let closedAfterInput = false;
  // Grammar C. `cells` accumulates one row's `<td>` texts; `labelValues` the
  // rows of the record currently open.
  let cells: string[] = [];
  let labelValues: { label: string; value: string }[] = [];

  // One function rather than the same assignments at both the open and the
  // close of a wrapper. The two copies were provably equivalent — none of these
  // fields is written while `depth === 0` — but a field added later gets added
  // to whichever copy the author found, and two resets that disagree is a
  // record inheriting the previous record's data.
  const resetRecord = () => {
    profile = null;
    date = null;
    cells = [];
    labelValues = [];
  };

  const closeRecord = () => {
    // EVERY closed wrapper is a record, including one that yielded neither a
    // profile anchor nor a label row. It becomes an entry with nothing in it,
    // which `resolveEntry` cannot read and `resolveEntries` therefore COUNTS —
    // and that count is the difference between "Instagram changed the record
    // model" and "you have no pending follow requests".
    //
    // Dropping it instead would make a grammar we have never seen come back as
    // an empty file: no drift warning, no `followRequestsUnreadable`, and
    // `notFollowingBack` inflated by every request the file held. That is
    // strictly worse than the JSON path, which has counted unreadable records
    // since GH#21, and this reader must not be the weaker of the two.
    //
    // A file with no records at all still yields nothing, because both grammars
    // leave one outermost wrapper per record and none when there are none.
    records.push({ profile, labelValues, date });
    resetRecord();
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        ancestors.push(text);
        text = '';
        tagsSeen++;

        if (name === 'table') {
          tables++;
          // A table outside every wrapper is a grammar-C record this reader
          // could not attribute to one — the wrapper class moved, not the list.
          if (depth === 0) orphanPayload = true;
        }

        if (name === 'div') {
          if (depth > 0) {
            depth++;
          } else if (RECORD_CLASS.test(attribs.class ?? '')) {
            depth = 1;
            resetRecord();
          }
          return;
        }

        // First profile link wins. A record holds one account; a second
        // instagram.com anchor would be something else, and taking the last
        // would let it overwrite the answer.
        //
        // Never inside a `<table>`: that is grammar C, whose username is a
        // labelled row and whose `URL` row holds whatever the account put in
        // its bio. An account whose bio links to another instagram.com profile
        // would otherwise be read as that profile — a wrong handle, counted as
        // resolved, on a record whose real handle is sitting one row above.
        if (name !== 'a') return;
        const candidate = attribs.href ?? '';
        const match = PROFILE_HREF.exec(candidate);
        if (!match?.[1]) return;

        // Same reasoning as the orphan table above: a profile link belonging to
        // no wrapper is a grammar-A/B record we could not attribute.
        if (depth === 0) {
          orphanPayload = true;
          return;
        }

        if (tables > 0 || profile !== null) return;
        profile = { username: match[1], href: candidate };
      },

      ontext(chunk) {
        if (depth > 0) text += chunk;
      },

      onclosetag(name) {
        if (inputEnded) closedAfterInput = true;
        if (name === 'table' && tables > 0) tables--;

        // Captured before the frame is popped, because both readings below need
        // it: the date, and a table cell.
        //
        // Accumulated across an element rather than read per text node, because
        // a parser may split text at any boundary it likes.
        const own = text;
        const captured = own.trim();
        // Inside a record the parent inherits what this element held; outside
        // one nothing accumulates, or the page-level element would end up
        // holding every record in the file at once.
        const parent = ancestors.pop() ?? '';
        text = depth > 0 ? parent + own : '';
        if (depth === 0) return;

        // The date is found by SHAPE, not by position — the first text inside
        // the record that parses as a row date. That is what lets one rule read
        // both grammars, whose dates sit in different places: grammar A/B puts
        // it in a sibling div of the anchor, grammar C in a div after the whole
        // table. Positional reading would be a second thing to break when Meta
        // rearranges a record, and it has rearranged records before without
        // touching a single class name.
        if (date === null) date = splitRowDate(captured);

        if (name === 'td') {
          cells.push(captured);
          return;
        }

        // Two cells is the whole shape: label, then value. Read by POSITION
        // rather than by the `_a6_q` / `_a6_r` classes that mark them, because
        // position is the part of a table that cannot be renamed. A row of any
        // other width is not a label pair and is dropped.
        if (name === 'tr') {
          const [label, value] = cells;
          if (cells.length === 2 && label) labelValues.push({ label, value: value ?? '' });
          cells = [];
          return;
        }

        if (name !== 'div') return;
        depth--;
        if (depth > 0) return;
        closeRecord();
        // The wrapper's own text was just inherited by the page level, which is
        // outside every record and must not carry it into the next one.
        text = '';
      },
    },
    // htmlparser2 12 decodes entities by default, so this is explicit rather
    // than load-bearing — and it is written down because the comment here used
    // to claim a decoder that is off "changes where tags are seen to end",
    // which is not what entity decoding does. What it actually buys: a `&amp;`
    // in a display name reaches `label_values` as `&`, the same character the
    // JSON export carries, so the two formats compare equal.
    { decodeEntities: true }
  );

  parser.write(html);
  inputEnded = true;
  parser.end();

  // A document that did not close its own tags is unreadable however many
  // records it appeared to yield — the collapse produces ONE record holding the
  // first account, which is a number, not an error.
  if (closedAfterInput) return null;
  if (records.length > 0) return records;

  // Nothing opened a tag: this is not a markup document. JSON bytes in a
  // `.html` entry land here, and so does an empty file.
  if (tagsSeen === 0) return null;

  // Markup, no wrappers. Either the wrapper class moved out from under records
  // that are still in the file, or the list is genuinely empty — and the
  // payload left lying outside every wrapper is what tells those apart.
  // Measured on the real fixtures: a well-formed export has zero orphan
  // anchors and zero orphan tables, an export with `uiBoxWhite` renamed has 25
  // and 9 respectively, and an export whose record list is emptied has none.
  return orphanPayload ? null : [];
}
