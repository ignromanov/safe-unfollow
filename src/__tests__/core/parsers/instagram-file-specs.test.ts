import { describe, expect, it } from 'vitest';
import { FILE_SPECS, RELEVANT_FILE_PATTERN } from '@/core/parsers/instagram-file-specs';

/**
 * Which entries an archive is allowed to hand back later.
 *
 * `openZipArchive` keeps a readable object only for entries matching this
 * pattern, so a file it does not name is a file the parser cannot open however
 * correctly everything downstream is written — it is reported missing, which is
 * a silent wrong answer rather than a crash. That makes this the first seam an
 * HTML export has to pass through.
 *
 * The expected names below are not invented. They are the entry list of a real
 * HTML export, `raw/real/2026-08-11-en-html-x9g96b0A`, whose nine relationship
 * files are each the JSON name with the extension swapped — no new base names,
 * no renames. That measurement is why the specs DERIVE their HTML names instead
 * of carrying a second hand-written list beside `fileNames`.
 */
describe('the files an HTML export is allowed to be read from', () => {
  const BASE = 'connections/followers_and_following';

  // The nine relationship files of the real archive, verbatim.
  const HTML_EXPORT_ENTRIES = [
    'close_friends.html',
    'custom_lists.html',
    'followers_1.html',
    'following.html',
    'pending_follow_requests.html',
    'recent_follow_requests.html',
    'recently_unfollowed_profiles.html',
    'removed_suggestions.html',
    'restricted_profiles.html',
  ];

  it('keeps every relationship file the real archive carries', () => {
    // `custom_lists` is the one exclusion, and it is deliberate: it is not in
    // FILE_SPECS, and `instagram-optional.ts` says why — it carries
    // label_values of a different label set and would pollute the archive-wide
    // username-label pool.
    const kept = HTML_EXPORT_ENTRIES.filter(name => RELEVANT_FILE_PATTERN.test(`${BASE}/${name}`));

    expect(kept).toEqual(HTML_EXPORT_ENTRIES.filter(name => name !== 'custom_lists.html'));
  });

  it('keeps a followers shard beyond the ones any spec names', () => {
    // `followers_*` is a regex rather than a name list on the JSON side because
    // an export sharded past `followers_3` is read today. The HTML side must
    // not be narrower than the JSON side it was derived from.
    expect(RELEVANT_FILE_PATTERN.test(`${BASE}/followers_7.html`)).toBe(true);
  });

  it('still keeps everything it kept before', () => {
    // The JSON side is what ships; widening must not narrow it.
    for (const spec of FILE_SPECS) {
      for (const name of spec.fileNames) {
        expect(RELEVANT_FILE_PATTERN.test(`${BASE}/${name}`)).toBe(true);
      }
    }
  });

  it('does not keep the export’s own navigation page', () => {
    // `start_here.html` sits at the archive root of every HTML export. Nothing
    // may read it, and more importantly nothing may retain an entry object for
    // it — the `keep` filter is a memory bound, not a preference.
    expect(RELEVANT_FILE_PATTERN.test('start_here.html')).toBe(false);
    expect(RELEVANT_FILE_PATTERN.test('files/Instagram-Logo.png')).toBe(false);
  });

  it('does not keep a file that merely ends in a name it knows', () => {
    expect(RELEVANT_FILE_PATTERN.test(`${BASE}/my-following.html`)).toBe(false);
    expect(RELEVANT_FILE_PATTERN.test(`${BASE}/following.html.bak`)).toBe(false);
  });
});
