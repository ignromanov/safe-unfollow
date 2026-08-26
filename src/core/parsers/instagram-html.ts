/**
 * Turns one relationship file's HTML into the shape its JSON twin would have.
 *
 * Meta's export dialog offers HTML or JSON, and roughly a fifth of the people
 * who reach this tool pick HTML. Today they are refused: `upload_error_html_format`
 * is 53.4% of all upload errors, and 60.2% of the sessions that hit it never
 * succeed at all. Nothing about the archive is unreadable — it holds the same
 * people, in the same order, with the same dates. It is written in a different
 * markup.
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
 * A third grammar ships in the seven OPTIONAL files: a `<table>` of label/value
 * rows — `Name`, `Username`, and `URL` when the account has a bio link — with
 * the date in a trailing div. Measured across the whole 2026-08-11 export: the
 * two required files hold 413 and 364 profile anchors and **zero tables**; the
 * optional ones hold nine, six, two and one tables and **zero profile
 * anchors**. The two never mix, so the reader tries the anchor and falls back
 * to the table rather than choosing between them.
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
 * badge, it would inflate the app's most-used one — silently, because an unread
 * file and an empty one are the same empty array, so `followRequestsUnreadable`
 * (GH#41) would stay false.
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
 * ## The one thing an empty answer must not mean
 *
 * Zero records is reported as zero records, never as a partial read. Both
 * grammars leave exactly one outermost record wrapper per record and NONE when
 * there are no records — measured: grammar C nests wrappers at div depths 3 and
 * 5, N at each for N records, with no outer collection wrapper to survive an
 * empty list. So a file whose wrapper class changed and a file belonging to a
 * user with no close friends both come back empty, and the layer above tells
 * them apart the way it already does for JSON: by whether the file was found.
 */

import { Parser } from 'htmlparser2';
import { fitMonthTable, readRowDate, splitRowDate } from './instagram-html-dates';

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
 *   not throw — an unreadable document yields no records, which the layer above
 *   reports as an empty or drifted file.
 */
export function parseRelationshipFile(name: string, text: string): unknown {
  return /\.html$/i.test(name) ? transcodeRelationshipHtml(text) : JSON.parse(text);
}

/**
 * The wrapper every record sits in, in every file, in every sample held.
 *
 * Matched as a whitespace-delimited class rather than a substring, so that a
 * future `uiBoxWhiteSomething` cannot be mistaken for it.
 */
const RECORD_CLASS = 'uiBoxWhite';

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
  /** Grammar A/B: the handle read out of the profile anchor. */
  username: string | null;
  /** Grammar A/B: the profile anchor itself. */
  href: string | null;
  /** Grammar C: the record's label/value rows, in document order. */
  labelValues: { label: string; value: string }[];
  dateText: string | null;
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
 * @returns the file's entries; empty when the record wrapper is not found,
 *   which is the drift signal rather than an answer.
 */
export function transcodeRelationshipHtml(html: string): unknown {
  const records = readRecords(html);

  // Two passes, and the second cannot be folded into the first: the month table
  // is fitted to the tokens of the WHOLE file, so no row can be dated until
  // every row has been seen. That is the point of fitting rather than choosing
  // — a per-row guess is exactly what a table nobody chose protects against.
  const tokens = records
    .map(r => (r.dateText === null ? null : splitRowDate(r.dateText)?.monthToken))
    .filter((t): t is string => typeof t === 'string');
  const monthTable = fitMonthTable(tokens);

  return records.map(({ username, href, labelValues, dateText }) => {
    const timestamp = dateText === null ? undefined : readRowDate(dateText, monthTable);

    // The anchor grammar first, because it is the one the two required files
    // use and the one whose `href` is worth keeping. A record never carries
    // both — measured, the anchor files hold zero tables and the table files
    // zero anchors — so the order is a preference, not a tiebreak.
    if (username !== null && href !== null) {
      // Omitted rather than zeroed when unreadable. `resolveEntry` reads
      // `item?.timestamp` and the parsers store `?? 0`, so the zero is applied
      // one layer down where it already means "Instagram gave no date" —
      // writing it here would make an unreadable date indistinguishable from an
      // absent one at the only layer that can still tell them apart.
      const entry: TranscodedEntry = { title: username, string_list_data: [{ href }] };
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
 */
function readRecords(html: string): RawRecord[] {
  const records: RawRecord[] = [];

  // Depth of `<div>` nesting inside the record currently open; 0 means none is.
  // Counted rather than matched on the closing tag, because the close carries
  // no class and the wrapper legitimately contains further divs.
  let depth = 0;
  let href: string | null = null;
  let username: string | null = null;
  let dateText: string | null = null;
  let text = '';
  // Grammar C. `cells` accumulates one row's `<td>` texts; `labelValues` the
  // rows of the record currently open.
  let cells: string[] = [];
  let labelValues: { label: string; value: string }[] = [];

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
    records.push({ username, href, labelValues, dateText });
    href = null;
    username = null;
    dateText = null;
    cells = [];
    labelValues = [];
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === 'div') {
          if (depth > 0) {
            depth++;
          } else if ((attribs.class ?? '').split(/\s+/).includes(RECORD_CLASS)) {
            depth = 1;
            href = null;
            username = null;
            dateText = null;
            cells = [];
            labelValues = [];
          }
          text = '';
          return;
        }

        text = '';

        // First profile link wins. A record holds one account; a second
        // instagram.com anchor would be something else, and taking the last
        // would let it overwrite the answer.
        if (depth === 0 || name !== 'a' || username !== null) return;
        const candidate = attribs.href ?? '';
        const match = PROFILE_HREF.exec(candidate);
        if (match?.[1]) {
          username = match[1];
          href = candidate;
        }
      },

      ontext(chunk) {
        if (depth > 0) text += chunk;
      },

      onclosetag(name) {
        // Captured before the reset, because both readings below need it: the
        // date, and a table cell.
        //
        // Accumulated across an element rather than read per text node, because
        // a parser may split text at any boundary it likes.
        const captured = text.trim();
        text = '';
        if (depth === 0) return;

        // The date is found by SHAPE, not by position — the first text inside
        // the record that parses as a row date. That is what lets one rule read
        // both grammars, whose dates sit in different places: grammar A/B puts
        // it in a sibling div of the anchor, grammar C in a div after the whole
        // table. Positional reading would be a second thing to break when Meta
        // rearranges a record, and it has rearranged records before without
        // touching a single class name.
        if (dateText === null && splitRowDate(captured) !== null) {
          dateText = captured;
        }

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
      },
    },
    // Entities matter: a handle cannot contain one, but the surrounding markup
    // can, and a decoder that is off changes where tags are seen to end.
    { decodeEntities: true }
  );

  parser.write(html);
  parser.end();

  return records;
}
