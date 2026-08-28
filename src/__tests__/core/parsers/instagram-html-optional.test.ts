import { describe, expect, it } from 'vitest';
import CLOSE_FRIENDS_HTML from '../../fixtures/instagram-html/close_friends.html?raw';
import CLOSE_FRIENDS_JSON from '../../fixtures/instagram-html/close_friends.json?raw';
import { transcodeRelationshipHtml } from '@/core/parsers/instagram-html';
import { resolveUsernameLabelWithMode } from '@/core/parsers/instagram-labels';
import { resolveEntries, resolveEntryList } from '@/core/parsers/instagram-utils';

/**
 * The optional files, whose records Meta writes in a different grammar.
 *
 * `following.html` and `followers_1.html` write an anchor to an Instagram
 * profile. The seven optional files write a `<table>` of label/value rows —
 * `Name`, `Username`, and `URL` when the account has a bio link — with the date
 * in a trailing div. Measured across the whole 2026-08-11 HTML export: 413 and
 * 364 profile anchors in the two required files and **zero tables**; nine, six,
 * two and one tables in the optional ones and **zero profile anchors**.
 *
 * That table is not a second record model to invent a reader for. It is the
 * `label_values` shape the 2026-08 JSON export already carries, rendered as
 * markup — same labels, same values, same order — so transcoding it yields
 * entries `resolveEntry` reads through its third shape and
 * `instagram-labels.ts` resolves the localised username label for, unchanged.
 *
 * **Why this file exists at all is a correctness stake, not completeness.**
 * `pending_follow_requests` and `recent_follow_requests` are subtracted from
 * `following` to compute `notFollowingBack` (`core/badges/index.ts`). A reader
 * that returned zero records from them would not empty a badge — it would
 * INFLATE the app's most-used one, silently, and `followRequestsUnreadable`
 * (GH#41) would stay false because an unread file and an empty one are the same
 * empty array. Every one of those files is grammar C.
 *
 * The pair below is one real `close_friends` in both formats from the same day,
 * redacted through one map across both files: `raw/real/2026-08-11-en-html-x9g96b0A`
 * and `raw/real/2026-08-11-en-json-Zzt7gCja`. `close_friends` is the fixture
 * because it is the only optional file carrying `URL` rows, which is the value
 * that must not become a profile link.
 */
const KEYS = ['relationships_close_friends'];

/** The production path, exactly as `parseOptionalFiles` walks it. */
function accounts(doc: unknown) {
  const entries = resolveEntryList(doc, KEYS) ?? [];
  const { label } = resolveUsernameLabelWithMode(entries, {
    tiebreakEntries: entries,
    knownUsernames: () => new Set<string>(),
  });
  return resolveEntries(entries, label);
}

describe('an optional file, in both formats, from the same export', () => {
  it('yields the same accounts from HTML as from JSON', () => {
    const fromHtml = accounts(transcodeRelationshipHtml(CLOSE_FRIENDS_HTML));
    const fromJson = accounts(JSON.parse(CLOSE_FRIENDS_JSON));

    expect(fromHtml.items.map(i => i.username).sort()).toEqual(
      fromJson.items.map(i => i.username).sort()
    );
    expect(fromHtml.items).toHaveLength(9);
  });

  it('leaves nothing counted as unreadable', () => {
    // The number this whole file is about. An unresolved count above zero on a
    // request file is what `followRequestsUnreadable` reports; a count of zero
    // beside nine accounts is what says the file was genuinely read.
    const read = accounts(transcodeRelationshipHtml(CLOSE_FRIENDS_HTML));

    // Both halves, or this passes on a reader that returns nothing: zero of
    // zero records is also zero unresolved.
    expect(read.items).toHaveLength(9);
    expect(read.unresolved).toBe(0);
  });

  it('does not turn the bio link into a profile link', () => {
    // `resolveEntry` drops `href` for the label_values shape deliberately: the
    // `URL` label holds whatever the account put in its bio — in one real
    // `removed_suggestions` it is a WhatsApp shortlink — so storing it would
    // aim a profile click off Instagram. The transcoder must not reintroduce
    // through markup what the reader refuses in JSON.
    const items = accounts(transcodeRelationshipHtml(CLOSE_FRIENDS_HTML)).items;

    // Counted first: `every` over an empty list is vacuously true, and the
    // reader that returns nothing is exactly the state this file starts from.
    expect(items).toHaveLength(9);
    expect(items.every(i => i.href === undefined)).toBe(true);
  });

  it('dates each record a constant offset from its JSON twin', () => {
    // Same claim, same reason as the required files: Meta renders the visible
    // date at a fixed UTC-8 with the seconds truncated, so the offset is a
    // 60-second-wide band and cancels in the only comparison anyone makes of
    // these timestamps.
    const fromHtml = new Map(
      accounts(transcodeRelationshipHtml(CLOSE_FRIENDS_HTML)).items.map(i => [i.username, i])
    );
    const fromJson = new Map(
      accounts(JSON.parse(CLOSE_FRIENDS_JSON)).items.map(i => [i.username, i])
    );

    const offsets = [...fromHtml].map(([name, item]) => {
      const twin = fromJson.get(name);
      return (item.timestamp ?? 0) - (twin?.timestamp ?? 0);
    });

    expect(offsets).toHaveLength(9);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(60);
  });
});

describe('an optional file with nothing in it', () => {
  it('reads as empty, not as drifted', () => {
    // The distinction the whole diagnostic layer rests on. A user with no close
    // friends must not be told their export drifted, and a file whose records
    // we could not read must not be reported as empty. Grammar C leaves one
    // record wrapper per record and NONE when there are no records — measured:
    // wrappers appear at div depths 3 and 5, N at each for N records, with no
    // outer collection wrapper to survive an empty list.
    const empty = CLOSE_FRIENDS_HTML.replace(
      /<main class="_a706" role="main">[\s\S]*<\/main>/,
      '<main class="_a706" role="main"></main>'
    );

    expect(resolveEntryList(transcodeRelationshipHtml(empty), KEYS)).toEqual([]);
  });
});

/**
 * Grammar C's two ways of being misread, both of which used to produce a
 * plausible number instead of an error.
 *
 * These files are the GH#41 files. `pending_follow_requests` and
 * `recent_follow_requests` are SUBTRACTED from `following`, so a reader that
 * loses their records inflates `notFollowingBack` by everything it lost —
 * silently, because `followRequestsUnreadable` is raised by an unreadable file
 * and not by an empty one.
 */
describe('grammar C read wrong', () => {
  it('reports a moved wrapper class as unreadable, not as an empty list', () => {
    // The distinction this module's header is written around. Records are still
    // in the file; only the wrapper this reader finds them by has moved. An
    // empty array here is the wrong answer with no warning attached — `null` is
    // the value `resolveEntryList` already turns into `INVALID_*_FORMAT`.
    const renamed = CLOSE_FRIENDS_HTML.split('uiBoxWhite').join('uiBoxSnow');

    expect(transcodeRelationshipHtml(renamed)).toBeNull();
  });

  it('does not read a bio link as the account', () => {
    // A `URL` row holds whatever the account put in its bio, and an account may
    // link to another Instagram profile. Read as an anchor record it replaces
    // the real `Username` row — a wrong handle, counted as resolved, with the
    // right one sitting one row above it.
    const withBioLink = CLOSE_FRIENDS_HTML.replace(
      '<tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">user001</td></tr>',
      '<tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">user001</td></tr>' +
        '<tr><td class="_a6_q">URL</td><td class="_2piu _a6_r">' +
        '<a href="https://www.instagram.com/brandpage">brandpage</a></td></tr>'
    );

    const names = accounts(transcodeRelationshipHtml(withBioLink)).items.map(i => i.username);
    expect(names).toContain('user001');
    expect(names).not.toContain('brandpage');
  });

  it('reads a value that Meta wrapped in an inline element', () => {
    // Meta changed this file's record model once already without touching a
    // class name. A `<span>` around the value is the same kind of change, and
    // it used to empty every value in the file: the reader kept only the
    // INNERMOST element's own text, so `<td><span>x</span></td>` read as ''.
    const wrapped = CLOSE_FRIENDS_HTML.replace(
      /(<td class="_2piu _a6_r">)([^<]*)(<\/td>)/g,
      '$1<span>$2</span>$3'
    );

    const names = accounts(transcodeRelationshipHtml(wrapped)).items.map(i => i.username);
    expect(names).toContain('user001');
  });
});
