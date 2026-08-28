import { describe, expect, it } from 'vitest';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../../fixtures/instagram-html/following.html?raw';
import FOLLOWING_EN from '../../fixtures/instagram-html/following.en.html?raw';
import FOLLOWING_ES from '../../fixtures/instagram-html/following.es.html?raw';
import FOLLOWING_JA from '../../fixtures/instagram-html/following.ja.html?raw';
import FOLLOWING_JSON from '../../fixtures/instagram-html/following.json?raw';
import { transcodeRelationshipHtml } from '@/core/parsers/instagram-html';
import { extractUsernames, resolveEntries, resolveEntryList } from '@/core/parsers/instagram-utils';

/**
 * The HTML transcoder against a golden pair — one real account's `following`
 * and `followers_1` as Meta wrote them on 2026-08-11, in both formats.
 *
 * **Why a real pair and not a synthetic one.** A fixture I generate proves only
 * that my generator agrees with my parser. These four files are Meta's own
 * bytes with the handles substituted and nothing else touched: every class
 * name, every date string, the record order, the `<base>` tag, the 13 817 bytes
 * of inline CSS, and the header `<time>` whose visible text disagrees with its own
 * `datetime` attribute by seven hours. That last one is not a defect in the
 * fixture — it is in the export, and it is why nothing here reads the header.
 *
 * The extracts are 25 records each, chosen as the first 25 of the HTML file's
 * own order that the JSON twin also carries, with one substitution map across
 * all four files so that a mutual stays a mutual — 31 distinct handles over 50
 * records, so 19 mutuals survive and the set algebra is still exercisable.
 *
 * Full-file equality was verified when the extracts were cut, and it is the
 * claim the extracts stand in for: `following` 413 = 413 and `followers_1`
 * 364 = 364, symmetric difference **0** in both.
 *
 * Assertions go through `resolveEntryList` + `resolveEntries` — the production
 * reader — rather than through a comparison written here. The transcoder's
 * whole contract is "hand the existing parser what it would have got from
 * JSON", so a test that reads the transcoder's output its own way would not
 * test that contract.
 */
/**
 * Usernames as the app would end up with them, sorted for set comparison.
 *
 * `extractUsernames` rather than a local `resolveEntries(...).items.map(...)`,
 * because that IS `extractUsernames` — and it is what `instagram.ts` and
 * `instagram-followers.ts` actually call. A hand-rolled equivalent would keep
 * passing if the production reduction ever changed underneath it, which defeats
 * the point of asserting through the production path at all.
 */
function usernames(doc: unknown, wrapperKeys: string[]): string[] {
  return extractUsernames(resolveEntryList(doc, wrapperKeys) ?? undefined).sort();
}

const FOLLOWING_KEYS = ['relationships_following'];
const FOLLOWERS_KEYS = ['relationships_followers'];

describe('the same account, the same day, both formats', () => {
  it('yields the same following set from HTML as from JSON', () => {
    // The one test that catches "the anchor missed a file". A transcoder that
    // silently reads none of a file returns an empty list, the parse still
    // succeeds, and every account in the other list is then accused —
    // `notFollowingBack` inflates by the entire size of the missing one. That
    // is the failure this whole subsystem exists to prevent, and set equality
    // against a real twin is the only assertion that sees it.
    expect(usernames(transcodeRelationshipHtml(FOLLOWING_HTML), FOLLOWING_KEYS)).toEqual(
      usernames(JSON.parse(FOLLOWING_JSON), FOLLOWING_KEYS)
    );
  });

  it('yields the same followers set from HTML as from JSON', () => {
    expect(usernames(transcodeRelationshipHtml(FOLLOWERS_HTML), FOLLOWERS_KEYS)).toEqual(
      usernames(JSON.parse(FOLLOWERS_JSON), FOLLOWERS_KEYS)
    );
  });

  it('reads both record grammars without being told which file it has', () => {
    // `following.html` writes `instagram.com/_u/NAME` and carries an `<h2>`
    // holding the username; `followers_1.html` writes `instagram.com/NAME`,
    // has no `<h2>` at all, and puts the username in the anchor's text.
    //
    // Keyed on the href the two are one grammar and this needs no branch.
    // Keyed on the anchor text they are two, and the second file is where the
    // next format change would silently return zero. The counts below are the
    // evidence that the unbranched reading actually covers both.
    expect(usernames(transcodeRelationshipHtml(FOLLOWING_HTML), FOLLOWING_KEYS)).toHaveLength(25);
    expect(usernames(transcodeRelationshipHtml(FOLLOWERS_HTML), FOLLOWERS_KEYS)).toHaveLength(25);
  });

  it('keeps the profile link, so a click still goes to Instagram', () => {
    const entries = resolveEntryList(transcodeRelationshipHtml(FOLLOWING_HTML), FOLLOWING_KEYS);
    const items = resolveEntries(entries ?? []).items;

    expect(items.every(i => i.href?.startsWith('https://www.instagram.com/'))).toBe(true);
  });
});

describe('the dates, against the same rows in the JSON twin', () => {
  const items = (doc: unknown, keys: string[]) =>
    new Map(resolveEntries(resolveEntryList(doc, keys) ?? []).items.map(i => [i.username, i]));

  const offsets = (html: string, json: string, keys: string[]): number[] => {
    const fromHtml = items(transcodeRelationshipHtml(html), keys);
    const fromJson = items(JSON.parse(json), keys);
    const out: number[] = [];
    for (const [name, htmlItem] of fromHtml) {
      const jsonItem = fromJson.get(name);
      if (htmlItem.timestamp && jsonItem?.timestamp) {
        out.push(htmlItem.timestamp - jsonItem.timestamp);
      }
    }
    return out;
  };

  it('dates every record it read', () => {
    const dated = [...items(transcodeRelationshipHtml(FOLLOWING_HTML), FOLLOWING_KEYS).values()];

    expect(dated).toHaveLength(25);
    expect(dated.every(i => typeof i.timestamp === 'number' && i.timestamp > 0)).toBe(true);
  });

  it('sits a constant offset from the JSON twin, not a scattered one', () => {
    // The claim being pinned is UNIFORMITY, not the value. Meta renders the
    // per-row dates at a fixed UTC−8 with no DST adjustment and truncates the
    // seconds, so HTML and JSON disagree by −28 800 s minus the dropped
    // seconds, i.e. a 60-second-wide band.
    //
    // Uniformity is what makes the offset harmless, and the argument is
    // algebraic rather than a tolerance: the only consumer of these timestamps
    // takes `followersOldest - followingOldest`, and a constant added to both
    // operands cancels — `(f+C) − (g+C) = f − g`. So the skew detector reads
    // an HTML export exactly as it reads a JSON one. A SCATTERED offset would
    // break that, which is why the spread is asserted and the value is not
    // corrected for.
    const all = [
      ...offsets(FOLLOWING_HTML, FOLLOWING_JSON, FOLLOWING_KEYS),
      ...offsets(FOLLOWERS_HTML, FOLLOWERS_JSON, FOLLOWERS_KEYS),
    ];

    expect(all.length).toBe(50);
    expect(Math.max(...all) - Math.min(...all)).toBeLessThan(60);
  });

  it('reads the same instants out of all three languages', () => {
    // Locale invariance for the DATES specifically, which is a stronger claim
    // than reading the same accounts: the month token, and the meridiem's case,
    // differ in all three files.
    const en = items(transcodeRelationshipHtml(FOLLOWING_EN), FOLLOWING_KEYS);
    const es = items(transcodeRelationshipHtml(FOLLOWING_ES), FOLLOWING_KEYS);
    const ja = items(transcodeRelationshipHtml(FOLLOWING_JA), FOLLOWING_KEYS);

    for (const [name, item] of en) {
      expect(es.get(name)?.timestamp).toBe(item.timestamp);
      expect(ja.get(name)?.timestamp).toBe(item.timestamp);
    }
    expect(en.size).toBe(20);
  });
});

describe('what the transcoder refuses to guess', () => {
  it('reports a document whose record wrapper is gone as unreadable', () => {
    // Drift resistance. Meta changed the optional files' record model between
    // 2026-03 and 2026-08 without notice, and `following`/`followers` are the
    // two that have never drifted — which is a fact about the past, not a
    // guarantee. If the record wrapper changes, the honest answer is `null`,
    // never a partial read presented as a whole one and never an empty list:
    // 25 profile anchors are still sitting in this document, and a reader that
    // returned `[]` would be reporting an account that follows nobody.
    const gutted = FOLLOWING_HTML.split('uiBoxWhite').join('uiBoxSomethingElse');

    expect(transcodeRelationshipHtml(gutted)).toBeNull();
    expect(usernames(transcodeRelationshipHtml(gutted), FOLLOWING_KEYS)).toEqual([]);
  });

  it('reports a truncated document as unreadable, not as one account', () => {
    // A download that stopped mid-file leaves every record after the cut nested
    // inside the one that was open, and htmlparser2 closes them all in a single
    // burst when the input runs out. The reader saw ONE wrapper close, so it
    // produced one record — the first account, with nothing counted as
    // unresolved and no way for any caller to know the other 24 existed.
    const cut = FOLLOWING_HTML.slice(0, FOLLOWING_HTML.length - 400);

    expect(transcodeRelationshipHtml(cut)).toBeNull();
  });

  it('reports bytes that are not markup as unreadable', () => {
    // A `.html` entry holding JSON opens no tag at all. Reading that as an
    // empty list would report a successful parse of a file nothing read.
    expect(transcodeRelationshipHtml(FOLLOWING_JSON)).toBeNull();
    expect(transcodeRelationshipHtml('')).toBeNull();
  });

  it('ignores links that are not Instagram profiles', () => {
    // Grammar C records carry an arbitrary bio link under a `URL` label — in
    // one real `removed_suggestions.html` it is a WhatsApp shortlink. Any
    // anchor that is not an instagram.com profile must not become an account.
    const withBioLink = FOLLOWING_HTML.replace(
      '<a target="_blank" href="https://www.instagram.com/_u/user001">',
      '<a target="_blank" href="https://wa.link/notaperson">'
    );

    const names = usernames(transcodeRelationshipHtml(withBioLink), FOLLOWING_KEYS);
    expect(names).not.toContain('notaperson');
    expect(names).toHaveLength(24);
  });
});
