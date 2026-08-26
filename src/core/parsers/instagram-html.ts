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
 * Two record grammars ship today:
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
 * Nothing here reads a class name that could be localised, a heading, a label,
 * or a file name. The class names ARE stable — byte-identical across five
 * months and three locales — but the record model behind them is not: Meta
 * changed the optional files from a flat anchor to a label table between
 * 2026-03 and 2026-08 while leaving every class name alone. So the wrapper
 * class is used to find record boundaries and the href is used to read the
 * record, and a change to either produces zero records rather than a partial
 * read presented as a whole one.
 *
 * ## What it does not carry yet
 *
 * Timestamps. The per-record date is localised human text — `Aug 10, 2026 6:32
 * pm`, `ago 10, 2026 6:32 p. m.`, `2026年8月10日 6:32 PM` — with no machine form
 * anywhere in the document. Reading it needs a month table fitted to the file's
 * own tokens, which is its own problem and its own commit. Until then every
 * record here has an undefined timestamp, which the parsers store as 0, which
 * makes `detectRelationshipSkew` return `insufficient-data` — visible and
 * counted since `65cb74a`, rather than silently indistinguishable from a clean
 * export. That degradation is the honest one and it is why that fix came first.
 */

import { Parser } from 'htmlparser2';
import { fitMonthTable, readRowDate, splitRowDate } from './instagram-html-dates';

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

/** One record, in the shape `resolveEntry` already reads from JSON. */
interface TranscodedEntry {
  title: string;
  string_list_data: [{ href: string; timestamp?: number }];
}

/** A record as read from the markup, before the file's month table is known. */
interface RawRecord {
  username: string;
  href: string;
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

  return records.map(({ username, href, dateText }) => {
    const timestamp = dateText === null ? undefined : readRowDate(dateText, monthTable);
    // Omitted rather than zeroed when unreadable. `resolveEntry` reads
    // `item?.timestamp` and the parsers store `?? 0`, so the zero is applied
    // one layer down where it already means "Instagram gave no date" — writing
    // it here would make an unreadable date indistinguishable from an absent
    // one at the only layer that can still tell them apart.
    const entry: TranscodedEntry = { title: username, string_list_data: [{ href }] };
    if (timestamp !== undefined) entry.string_list_data[0].timestamp = timestamp;
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
        // The date is found by SHAPE, not by position — the first text inside
        // the record that parses as a row date. Positional reading ("the div
        // after the anchor's div") would be a second thing to break when Meta
        // rearranges a record, and it has rearranged records before without
        // touching a single class name.
        //
        // Accumulated across an element rather than read per text node, because
        // a parser may split text at any boundary it likes.
        if (depth > 0 && dateText === null && splitRowDate(text.trim()) !== null) {
          dateText = text.trim();
        }
        text = '';

        if (name !== 'div' || depth === 0) return;
        depth--;
        if (depth > 0) return;

        // A record with no profile link is dropped rather than guessed at.
        // `resolveEntries` counts what it cannot read, so a file that starts
        // producing these leaves a trace instead of quietly shrinking.
        if (username !== null && href !== null) {
          records.push({ username, href, dateText });
        }
        href = null;
        username = null;
        dateText = null;
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
