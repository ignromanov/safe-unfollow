import { beforeEach, describe, expect, it, vi } from 'vitest';
import CLOSE_FRIENDS_HTML from '../../fixtures/instagram-html/close_friends.html?raw';
import CLOSE_FRIENDS_JSON from '../../fixtures/instagram-html/close_friends.json?raw';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../../fixtures/instagram-html/following.html?raw';
import FOLLOWING_JSON from '../../fixtures/instagram-html/following.json?raw';
import { parseInstagramZipFile } from '@/core/parsers/instagram';

/**
 * GH#302 — in the older layout, `followers_and_following/` sits at the archive
 * root, and the followers shard globs were anchored against the whole entry
 * path with `.*` free to cross `/`. The root fallback `^followers_.*\.html$`
 * therefore matched every file in that folder, `following.html` included, and
 * each was read as a followers shard.
 *
 * HTML: the transcoder returns bare entries, so the reader's followings were
 * unioned into their followers and `notFollowingBack` read 0 with no error.
 * JSON: `following.json`'s `relationships_following` wrapper failed the shape
 * check, so a supported layout was refused as INVALID_FOLLOWERS_FORMAT.
 *
 * Every case is compared with the same bytes under `connections/…`, the layout
 * that was always read correctly. That control is what makes a red here mean
 * "the layout changed the answer" rather than "the fixture is odd".
 */

const CONNECTIONS = 'connections/followers_and_following';
const LEGACY = 'followers_and_following';

let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/parsers/zip-archive')>()),
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

const FIXTURES = {
  json: { following: FOLLOWING_JSON, followers: FOLLOWERS_JSON, closeFriends: CLOSE_FRIENDS_JSON },
  html: { following: FOLLOWING_HTML, followers: FOLLOWERS_HTML, closeFriends: CLOSE_FRIENDS_HTML },
} as const;

async function parseUnder(base: string, ext: 'json' | 'html') {
  mockZipInstance = new MockZipArchive();
  const files = FIXTURES[ext];
  mockZipInstance._addFile(`${base}/following.${ext}`, vi.fn().mockResolvedValue(files.following));
  mockZipInstance._addFile(
    `${base}/followers_1.${ext}`,
    vi.fn().mockResolvedValue(files.followers)
  );
  mockZipInstance._addFile(
    `${base}/close_friends.${ext}`,
    vi.fn().mockResolvedValue(files.closeFriends)
  );
  return parseInstagramZipFile(new File(['test'], 'test.zip', { type: 'application/zip' }));
}

describe.each(['json', 'html'] as const)(
  'the older followers_and_following/ layout reads like connections/ (%s)',
  ext => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('control: under connections/ the fixture parses with no error warning', async () => {
      const result = await parseUnder(CONNECTIONS, ext);

      const errors = result.warnings.filter(w => w.severity === 'error');
      expect(errors, JSON.stringify(errors)).toEqual([]);
      expect(result.data.followers.size).toBeGreaterThan(0);
    });

    it('reads the same followers as connections/, and no sibling as a shard', async () => {
      const control = await parseUnder(CONNECTIONS, ext);
      const legacy = await parseUnder(LEGACY, ext);

      const errors = legacy.warnings.filter(w => w.severity === 'error');
      expect(errors, JSON.stringify(errors)).toEqual([]);
      expect([...legacy.data.followers].sort()).toEqual([...control.data.followers].sort());
      expect(legacy.discovery.files.find(f => f.name === 'followers_*.json')?.foundPath).toBe(
        `${LEGACY}/followers_1.${ext}`
      );
    });
  }
);
