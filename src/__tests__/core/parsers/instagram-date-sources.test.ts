import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../../fixtures/instagram-html/following.html?raw';
import FOLLOWING_JSON from '../../fixtures/instagram-html/following.json?raw';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { zoneOfPaths } from '@/core/parsers/instagram-date-sources';

const BASE = 'connections/followers_and_following';
type Format = 'json' | 'html';

// A Blob cast, not a File: vitest/file-mock.ts replaces global.File with a stub.
const zipOf = async (files: Record<string, string>) => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return (await zip.generateAsync({ type: 'blob' })) as File;
};

async function parse(opts: { following: Format; followers: Format[]; closeFriends?: Format }) {
  const files: Record<string, string> = {
    [`${BASE}/following.${opts.following}`]:
      opts.following === 'json' ? FOLLOWING_JSON : FOLLOWING_HTML,
  };
  opts.followers.forEach((fmt, i) => {
    files[`${BASE}/followers_${i + 1}.${fmt}`] = fmt === 'json' ? FOLLOWERS_JSON : FOLLOWERS_HTML;
  });
  if (opts.closeFriends) {
    files[`${BASE}/close_friends.${opts.closeFriends}`] =
      opts.closeFriends === 'json' ? FOLLOWERS_JSON : FOLLOWERS_HTML;
  }
  return parseInstagramZipFile(await zipOf(files));
}

describe('zoneOfPaths', () => {
  it('html is utc, json is local, both is mixed, none is undefined', () => {
    expect(zoneOfPaths(['a/following.html'])).toBe('utc');
    expect(zoneOfPaths(['a/followers_1.json', 'a/followers_2.JSON'])).toBe('local');
    expect(zoneOfPaths(['a/followers_1.json', 'a/followers_2.html'])).toBe('mixed');
    expect(zoneOfPaths([])).toBeUndefined();
  });
});

describe('parseInstagramZipFile -> dateSources', () => {
  it('a JSON export is local for both relationship badges', async () =>
    expect((await parse({ following: 'json', followers: ['json'] })).dateSources).toEqual({
      following: 'local',
      followers: 'local',
    }));
  it('an HTML export is utc for both', async () =>
    expect((await parse({ following: 'html', followers: ['html'] })).dateSources).toEqual({
      following: 'utc',
      followers: 'utc',
    }));
  it("a mixed archive gets each badge its own file's zone", async () =>
    expect((await parse({ following: 'json', followers: ['html'] })).dateSources).toEqual({
      following: 'local',
      followers: 'utc',
    }));
  it('followers shards in both formats are mixed', async () =>
    expect(
      (await parse({ following: 'json', followers: ['json', 'html'] })).dateSources.followers
    ).toBe('mixed'));
  it('an optional file reports under its badge key', async () =>
    expect(
      (await parse({ following: 'json', followers: ['json'], closeFriends: 'html' })).dateSources
        .close
    ).toBe('utc'));
  it('a ZIP that is not an Instagram export reports nothing', async () =>
    expect((await parseInstagramZipFile(await zipOf({ 'notes.txt': 'x' }))).dateSources).toEqual(
      {}
    ));
});
