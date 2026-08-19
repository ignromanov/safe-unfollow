import { vi, beforeEach } from 'vitest';
import {
  parseFollowingJson,
  parseFollowersJson,
  parseInstagramZipFile,
} from '@/core/parsers/instagram';
import type { InstagramExportEntry } from '@/core/types';
import {
  ARRAY_NO_USERNAME_FIELD,
  EMPTY_ARRAY,
  NULL_PAYLOAD,
  UNKNOWN_TOP_LEVEL_KEY,
  VALID_ARRAY_OF_ONE,
  objectInsteadOfArray,
} from '../../fixtures/instagram-format-drift';

// Mock the ZIP reader, not whichever library is behind it
let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', () => ({
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

// Hoisted mock setup
const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

describe('Instagram Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFollowingJson', () => {
    it('should parse array format following data', async () => {
      const followingData: InstagramExportEntry[] = [
        {
          title: 'user1',
          string_list_data: [
            {
              href: 'https://www.instagram.com/user1/',
              value: 'user1',
              timestamp: 1640995200,
            },
          ],
          media_list_data: [],
        },
        {
          title: 'user2',
          string_list_data: [
            {
              href: 'https://www.instagram.com/user2/',
              value: 'user2',
              timestamp: 1640995201,
            },
          ],
          media_list_data: [],
        },
      ];

      const result = await parseFollowingJson(JSON.stringify(followingData));
      expect(result).toEqual(['user1', 'user2']);
    });

    it('should parse object format following data', async () => {
      const followingData = {
        relationships_following: [
          {
            title: 'user1',
            string_list_data: [
              {
                href: 'https://www.instagram.com/user1/',
                value: 'user1',
                timestamp: 1640995200,
              },
            ],
            media_list_data: [],
          },
        ],
      };

      const result = await parseFollowingJson(JSON.stringify(followingData));
      expect(result).toEqual(['user1']);
    });

    it('should handle empty following data', async () => {
      const result = await parseFollowingJson(JSON.stringify([]));
      expect(result).toEqual([]);
    });

    it('should normalize usernames to lowercase', async () => {
      const followingData: InstagramExportEntry[] = [
        {
          title: 'USER1',
          string_list_data: [
            {
              href: 'https://www.instagram.com/USER1/',
              value: 'USER1',
              timestamp: 1640995200,
            },
          ],
          media_list_data: [],
        },
      ];

      const result = await parseFollowingJson(JSON.stringify(followingData));
      expect(result).toEqual(['user1']);
    });

    it('should remove duplicate usernames', async () => {
      const followingData: InstagramExportEntry[] = [
        {
          title: 'user1',
          string_list_data: [
            {
              href: 'https://www.instagram.com/user1/',
              value: 'user1',
              timestamp: 1640995200,
            },
          ],
          media_list_data: [],
        },
        {
          title: 'user1',
          string_list_data: [
            {
              href: 'https://www.instagram.com/user1/',
              value: 'user1',
              timestamp: 1640995201,
            },
          ],
          media_list_data: [],
        },
      ];

      const result = await parseFollowingJson(JSON.stringify(followingData));
      expect(result).toEqual(['user1']);
    });

    it('should throw error for invalid format', async () => {
      const invalidData = { invalid: 'data' };

      await expect(parseFollowingJson(JSON.stringify(invalidData))).rejects.toThrow(
        'Invalid following.json: missing relationships_following'
      );
    });
  });

  describe('parseFollowersJson', () => {
    it('should parse array format followers data', async () => {
      const followersData: InstagramExportEntry[] = [
        {
          title: 'follower1',
          string_list_data: [
            {
              href: 'https://www.instagram.com/follower1/',
              value: 'follower1',
              timestamp: 1640995200,
            },
          ],
          media_list_data: [],
        },
      ];

      const result = await parseFollowersJson(JSON.stringify(followersData));
      expect(result).toEqual(['follower1']);
    });

    it('should parse object format followers data', async () => {
      const followersData = {
        relationships_followers: [
          {
            title: 'follower1',
            string_list_data: [
              {
                href: 'https://www.instagram.com/follower1/',
                value: 'follower1',
                timestamp: 1640995200,
              },
            ],
            media_list_data: [],
          },
        ],
      };

      const result = await parseFollowersJson(JSON.stringify(followersData));
      expect(result).toEqual(['follower1']);
    });

    it('should throw error for invalid followers format', async () => {
      const invalidData = { invalid: 'data' };

      await expect(parseFollowersJson(JSON.stringify(invalidData))).rejects.toThrow(
        'Invalid followers json format'
      );
    });
  });

  describe('parseInstagramZipFile', () => {
    beforeEach(() => {
      mockZipInstance = new MockZipArchive();
    });

    it('should parse complete ZIP file with all data types', async () => {
      // Add mock files to the ZIP
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'user1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/user1/',
                  value: 'user1',
                  timestamp: 1640995200,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'follower1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/follower1/',
                  value: 'follower1',
                  timestamp: 1640995201,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/pending_follow_requests.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'pending1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/pending1/',
                  value: 'pending1',
                  timestamp: 1640995202,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/restricted_profiles.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'restricted1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/restricted1/',
                  value: 'restricted1',
                  timestamp: 1640995203,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      // New ParseResult format: data is in result.data
      expect(result.hasMinimalData).toBe(true);
      expect(result.data.following.has('user1')).toBe(true);
      expect(result.data.followers.has('follower1')).toBe(true);
      expect(result.data.pendingSent.has('pending1')).toBe(true);
      expect(result.data.restricted.has('restricted1')).toBe(true);
      expect(result.data.followingTimestamps.get('user1')).toBe(1640995200);
      expect(result.data.followersTimestamps.get('follower1')).toBe(1640995201);
    });

    it('should handle ZIP file with minimal data', async () => {
      // Add only following file
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'user1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/user1/',
                  value: 'user1',
                  timestamp: 1640995200,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      // Minimal data = only following.json
      expect(result.hasMinimalData).toBe(true);
      expect(result.data.following.has('user1')).toBe(true);
      expect(result.data.followers.size).toBe(0);
      expect(result.data.pendingSent.size).toBe(0);
    });

    it('should handle multiple followers files', async () => {
      // Add multiple followers files
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify([]))
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'follower1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/follower1/',
                  value: 'follower1',
                  timestamp: 1640995200,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_2.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'follower2',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/follower2/',
                  value: 'follower2',
                  timestamp: 1640995201,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.data.followers.has('follower1')).toBe(true);
      expect(result.data.followers.has('follower2')).toBe(true);
      expect(result.data.followers.size).toBe(2);
    });

    it('should return hasMinimalData=false for empty ZIP file', async () => {
      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });

      // New: parseInstagramZipFile returns result instead of throwing
      const result = await parseInstagramZipFile(mockFile);
      expect(result.hasMinimalData).toBe(false);
      expect(result.discovery.isInstagramExport).toBe(false);
      // Should have error-level warning
      const errorWarning = result.warnings.find(w => w.severity === 'error');
      expect(errorWarning).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      // Add malformed JSON file
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue('invalid json')
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });

      // New: returns result with hasMinimalData=false instead of throwing
      const result = await parseInstagramZipFile(mockFile);
      expect(result.hasMinimalData).toBe(false);
    });

    it('should preserve timestamps correctly', async () => {
      const testTimestamp = 1640995200;

      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'user1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/user1/',
                  value: 'user1',
                  timestamp: testTimestamp,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify([]))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.data.followingTimestamps.get('user1')).toBe(testTimestamp);
    });

    it('should handle missing timestamp gracefully', async () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'user1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/user1/',
                  value: 'user1',
                  // No timestamp
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify([]))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.data.followingTimestamps.get('user1')).toBe(0);
    });

    it('should handle followers files with different naming patterns', async () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify([]))
      );

      // Add followers file with different pattern to trigger line 110-111
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_2.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'user1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/user1/',
                  value: 'user1',
                  timestamp: 1234567890,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.data.followersTimestamps.get('user1')).toBe(1234567890);
    });

    it('should parse new Instagram format with username in title only (no value field)', async () => {
      // New Instagram format (2026+): username is in entry.title, not in string_list_data[0].value
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify({
            relationships_following: [
              {
                title: 'newformat_user1',
                string_list_data: [
                  {
                    href: 'https://www.instagram.com/_u/newformat_user1',
                    timestamp: 1765477864,
                    // Note: no 'value' field - this is the new format
                  },
                ],
                media_list_data: [],
              },
              {
                title: 'newformat_user2',
                string_list_data: [
                  {
                    href: 'https://www.instagram.com/_u/newformat_user2',
                    timestamp: 1765063724,
                  },
                ],
                media_list_data: [],
              },
            ],
          })
        )
      );

      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'newformat_follower1',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/_u/newformat_follower1',
                  timestamp: 1765000000,
                },
              ],
              media_list_data: [],
            },
          ])
        )
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.hasMinimalData).toBe(true);
      expect(result.data.following.has('newformat_user1')).toBe(true);
      expect(result.data.following.has('newformat_user2')).toBe(true);
      expect(result.data.followers.has('newformat_follower1')).toBe(true);
      expect(result.data.followingTimestamps.get('newformat_user1')).toBe(1765477864);
      expect(result.data.followersTimestamps.get('newformat_follower1')).toBe(1765000000);
    });
  });

  // GH#21: following.json is PRESENT but its top-level shape is unrecognized.
  // Before the fix this silently produced an empty Set, indistinguishable from
  // a genuinely empty file — and downstream badge math (notFollowedBack =
  // followers not in following) confidently flagged every follower as
  // "not following back". These tests go through parseInstagramZipFile, the
  // actual production entry point — not the deprecated parseFollowingJson
  // standalone helper.
  describe('entry count', () => {
    beforeEach(() => {
      mockZipInstance = new MockZipArchive();
    });

    // A plain resolved-promise thunk, not vi.fn(): the filler entries are never
    // read, and 200,000 spies with call tracking cost seconds and gigabytes.
    const unreadFiller = () => Promise.resolve('');

    const addRequiredFiles = () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue('{"relationships_following":[]}')
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue('[]')
      );
    };

    it('accepts a real export with more entries than the old zip-bomb limit', async () => {
      addRequiredFiles();
      // 30,000 media files, one ZIP entry each — an "All of your information"
      // export from a decade-old account. The old 10,000 limit called that fake.
      for (let i = 0; i < 30_000; i++) {
        mockZipInstance._addFile(`media/posts/photo_${i}.jpg`, unreadFiller);
      }

      const file = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(file);

      expect(result.warnings.map(w => w.code)).not.toContain('CORRUPTED_ZIP');
      expect(result.warnings.map(w => w.code)).not.toContain('TOO_MANY_ENTRIES');
      expect(result.discovery.isInstagramExport).toBe(true);
    });

    it('still refuses an absurd count, and blames our limit rather than the file', async () => {
      addRequiredFiles();
      for (let i = 0; i < 200_001; i++) {
        mockZipInstance._addFile(`f_${i}`, unreadFiller);
      }

      const file = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(file);
      const warning = result.warnings.find(w => w.code === 'TOO_MANY_ENTRIES');

      expect(warning).toBeDefined();
      expect(warning!.message).not.toMatch(/does not look like a valid/i);
    });
  });

  describe('following.json format drift (GH#21)', () => {
    beforeEach(() => {
      mockZipInstance = new MockZipArchive();
      // A valid, non-empty followers file so hasMinimalData stays true and we
      // can observe the following-specific warning in isolation.
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify([{ ...VALID_ARRAY_OF_ONE[0]!, title: 'flw' }]))
      );
    });

    it.each([
      ['unknown top-level key', UNKNOWN_TOP_LEVEL_KEY],
      ['null payload', NULL_PAYLOAD],
      ['object instead of array', objectInsteadOfArray('relationships_following')],
    ])('flags following.json as INVALID_FOLLOWING_FORMAT (error) for %s', async (_label, data) => {
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(data))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      const drift = result.warnings.find(w => w.code === 'INVALID_FOLLOWING_FORMAT');
      expect(drift).toBeDefined();
      expect(drift?.severity).toBe('error');
      expect(result.data.following.size).toBe(0);
      // Must not ALSO report the old empty-file signal — that would make the
      // new error indistinguishable from the case it's meant to separate from.
      expect(result.warnings.find(w => w.code === 'EMPTY_FOLLOWING')).toBeUndefined();
    });

    it('does NOT trip INVALID_FOLLOWING_FORMAT for a genuinely empty array (regression)', async () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(EMPTY_ARRAY))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWING_FORMAT')).toBeUndefined();
      const info = result.warnings.find(w => w.code === 'EMPTY_FOLLOWING');
      expect(info).toBeDefined();
      expect(info?.severity).toBe('info');
    });

    it('reports an array with no recognizable username field as unreadable, not empty (GH#21 Task 3)', async () => {
      // Behaviour change. This case used to report EMPTY_FOLLOWING, which is
      // the exact conflation GH#21 is about: one record was present and we
      // could not read it. The wrapper was fine, so #32's file-level signal
      // stays silent and only the entry-level one fires.
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(ARRAY_NO_USERNAME_FIELD))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWING_FORMAT')).toBeUndefined();
      expect(result.warnings.find(w => w.code === 'EMPTY_FOLLOWING')).toBeUndefined();
      expect(result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWING')).toBeDefined();
    });

    it('accepts a single bare entry object without INVALID_FOLLOWING_FORMAT (GH#21 Task 2)', async () => {
      // following.json has not been observed to drift into this shape, but it
      // shared the same Array.isArray ladder the optional files did — this
      // pins that the shared resolveEntryList fix reaches it too.
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE[0]))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWING_FORMAT')).toBeUndefined();
      expect(result.data.following.has('validuser')).toBe(true);
    });
  });

  /**
   * GH#21 Task 3, the worst outcome the issue predicted and the one #32 does
   * not reach. `hasMinimalData` was `following.length > 0 || followers > 0` —
   * an OR — so a following.json that is a well-formed array of unreadable
   * records left followers alone holding the flag true, the upload succeeded,
   * and every single follower came back badged "not following back".
   */
  describe('required files with unreadable records (GH#21 Task 3)', () => {
    // A well-formed array whose records use no shape we can read. The wrapper
    // parses, so formatValid stays true and #32 sees nothing wrong.
    const unreadableRecords = [{ media_list_data: [] }, { media_list_data: [] }];

    function zipWith(following: unknown, followers: unknown) {
      mockZipInstance = new MockZipArchive();
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(following))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(followers))
      );
      return new File(['test'], 'test.zip', { type: 'application/zip' });
    }

    it('refuses minimal data when following.json is present but unreadable', async () => {
      const result = await parseInstagramZipFile(zipWith(unreadableRecords, VALID_ARRAY_OF_ONE));

      // Followers parsed fine and alone would have carried the OR.
      expect(result.data.followers.size).toBe(1);
      expect(result.data.following.size).toBe(0);
      expect(result.hasMinimalData).toBe(false);

      const drift = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWING');
      expect(drift).toBeDefined();
      expect(drift?.severity).toBe('error');
      expect(drift?.message).toMatch(/none of them/i);
      expect(drift?.fix).toMatch(/re-requesting/i);
    });

    it('refuses minimal data when followers_*.json is present but unreadable', async () => {
      const result = await parseInstagramZipFile(zipWith(VALID_ARRAY_OF_ONE, unreadableRecords));

      expect(result.data.following.size).toBe(1);
      expect(result.hasMinimalData).toBe(false);

      const drift = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWERS');
      expect(drift).toBeDefined();
      expect(drift?.severity).toBe('error');
    });

    it('does not send "cannot read this" out through the "no data" exit', async () => {
      const result = await parseInstagramZipFile(zipWith(unreadableRecords, VALID_ARRAY_OF_ONE));

      // Both callers of hasMinimalData (parse-worker, parse-orchestration) take
      // the FIRST error warning as the diagnostic code. If the generic critical
      // error were appended too, a reader whose export is intact would be told
      // to re-request data they already have.
      expect(result.warnings.find(w => w.code === 'NO_DATA_FILES')).toBeUndefined();
      expect(result.warnings.find(w => w.code === 'INCOMPLETE_EXPORT')).toBeUndefined();
      expect(result.warnings.find(w => w.code === 'NOT_INSTAGRAM_EXPORT')).toBeUndefined();
      expect(result.warnings.find(w => w.severity === 'error')?.code).toBe(
        'UNRESOLVED_ENTRIES_FOLLOWING'
      );
    });

    it('keeps a genuinely empty following.json on the old, quiet path', async () => {
      const result = await parseInstagramZipFile(zipWith(EMPTY_ARRAY, VALID_ARRAY_OF_ONE));

      // Nothing was unreadable, so nothing is loud, and one working required
      // file is still enough to analyse.
      expect(result.hasMinimalData).toBe(true);
      expect(result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWING')).toBeUndefined();
      expect(result.warnings.find(w => w.code === 'EMPTY_FOLLOWING')?.severity).toBe('info');
    });

    it('degrades rather than fails when only some records are unreadable', async () => {
      const partial = [...VALID_ARRAY_OF_ONE, { media_list_data: [] }];
      const result = await parseInstagramZipFile(zipWith(partial, VALID_ARRAY_OF_ONE));

      // One account read, one lost. The result is incomplete, not wrong-way-
      // round, and blocking the whole upload over it would be disproportionate.
      expect(result.hasMinimalData).toBe(true);
      const drift = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWING');
      expect(drift).toBeDefined();
      expect(drift?.severity).toBe('warning');
      expect(drift?.message).not.toMatch(/none of them/i);
    });

    // The wrapper half of the same gate. An unrecognised wrapper and an
    // unreadable set of records produce the identical wrong answer — every
    // follower badged notFollowedBack — so they cannot be gated differently.
    // Severity alone does not route: instagram.ts only consults warnings after
    // hasMinimalData has already said false.
    it('refuses minimal data when following.json’s wrapper is unrecognised', async () => {
      const result = await parseInstagramZipFile(
        zipWith(UNKNOWN_TOP_LEVEL_KEY, VALID_ARRAY_OF_ONE)
      );

      expect(result.data.followers.size).toBe(1);
      expect(result.data.following.size).toBe(0);
      expect(result.hasMinimalData).toBe(false);
      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWING_FORMAT')?.severity).toBe(
        'error'
      );
      // Ours stays the first error, so the generic "no data" copy never fronts it.
      expect(result.warnings.find(w => w.severity === 'error')?.code).toBe(
        'INVALID_FOLLOWING_FORMAT'
      );
      expect(result.warnings.find(w => w.code === 'NO_DATA_FILES')).toBeUndefined();
    });

    it('refuses minimal data when a followers shard’s wrapper is unrecognised', async () => {
      const result = await parseInstagramZipFile(
        zipWith(VALID_ARRAY_OF_ONE, UNKNOWN_TOP_LEVEL_KEY)
      );

      expect(result.data.following.size).toBe(1);
      expect(result.hasMinimalData).toBe(false);
      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT')?.severity).toBe(
        'error'
      );
      expect(result.warnings.find(w => w.code === 'NO_DATA_FILES')).toBeUndefined();
    });

    // The two cases this change could plausibly break, and breaking either
    // turns working uploads into error screens.
    it('leaves a genuinely empty required file alone, either side', async () => {
      const emptyFollowing = await parseInstagramZipFile(zipWith(EMPTY_ARRAY, VALID_ARRAY_OF_ONE));
      expect(emptyFollowing.hasMinimalData).toBe(true);
      expect(emptyFollowing.warnings.find(w => w.severity === 'error')).toBeUndefined();

      const emptyFollowers = await parseInstagramZipFile(zipWith(VALID_ARRAY_OF_ONE, EMPTY_ARRAY));
      expect(emptyFollowers.hasMinimalData).toBe(true);
      expect(emptyFollowers.warnings.find(w => w.severity === 'error')).toBeUndefined();
    });

    // `hasMinimalData: false` with no error-severity warning is a silent dead
    // end on the most critical path: parse-worker.ts:51 and
    // parse-orchestration.ts:115 both take the FIRST error warning as the
    // diagnostic code, and this task deliberately removed the unconditional
    // createCriticalError that used to guarantee one existed. Nothing else
    // enforces the implication, so this does.
    it.each([
      ['following wrapper unrecognised', UNKNOWN_TOP_LEVEL_KEY, VALID_ARRAY_OF_ONE],
      ['following records unreadable', [{ media_list_data: [] }], VALID_ARRAY_OF_ONE],
      ['followers wrapper unrecognised', VALID_ARRAY_OF_ONE, UNKNOWN_TOP_LEVEL_KEY],
      ['followers records unreadable', VALID_ARRAY_OF_ONE, [{ media_list_data: [] }]],
      ['both genuinely empty', EMPTY_ARRAY, EMPTY_ARRAY],
    ])('never refuses an upload without saying why (%s)', async (_label, following, followers) => {
      const result = await parseInstagramZipFile(zipWith(following, followers));

      expect(result.hasMinimalData).toBe(false);
      const firstError = result.warnings.find(w => w.severity === 'error');
      expect(firstError).toBeDefined();
      expect(firstError?.message).toBeTruthy();
    });

    it('leaves an absent required file alone', async () => {
      // "Absent" and "present but unreadable" are different answers and this
      // whole task exists to keep them apart. interpretFollowingPayload
      // (undefined) reports formatInvalid: false, and the gate must not read
      // that as a failure to parse.
      mockZipInstance = new MockZipArchive();
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
      );
      const result = await parseInstagramZipFile(
        new File(['test'], 'test.zip', { type: 'application/zip' })
      );

      expect(result.hasMinimalData).toBe(true);
      expect(result.warnings.find(w => w.code === 'MISSING_FOLLOWING')?.severity).toBe('warning');
      expect(result.warnings.find(w => w.severity === 'error')).toBeUndefined();
    });
  });

  // GH#21, followers side. followers_*.json is glob-matched and multi-file —
  // the fix must aggregate drift across shards rather than lose it silently
  // when at least one shard has a recognized shape.
  describe('followers_*.json format drift (GH#21)', () => {
    beforeEach(() => {
      mockZipInstance = new MockZipArchive();
      // A valid, non-empty following file so hasMinimalData stays true and we
      // can observe the followers-specific warning in isolation.
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
      );
    });

    it.each([
      ['unknown top-level key', UNKNOWN_TOP_LEVEL_KEY],
      ['null payload', NULL_PAYLOAD],
      ['object instead of array', objectInsteadOfArray('relationships_followers')],
    ])(
      'flags followers_*.json as INVALID_FOLLOWERS_FORMAT (error) for %s',
      async (_label, data) => {
        mockZipInstance._addFile(
          'connections/followers_and_following/followers_1.json',
          vi.fn().mockResolvedValue(JSON.stringify(data))
        );

        const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
        const result = await parseInstagramZipFile(mockFile);

        const drift = result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT');
        expect(drift).toBeDefined();
        expect(drift?.severity).toBe('error');
        expect(result.data.followers.size).toBe(0);
        expect(result.warnings.find(w => w.code === 'EMPTY_FOLLOWERS')).toBeUndefined();
      }
    );

    it('does NOT trip INVALID_FOLLOWERS_FORMAT for a genuinely empty array (regression)', async () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(EMPTY_ARRAY))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT')).toBeUndefined();
      const info = result.warnings.find(w => w.code === 'EMPTY_FOLLOWERS');
      expect(info).toBeDefined();
      expect(info?.severity).toBe('info');
    });

    it('flags the whole followers set when one shard drifts even though another shard is valid', async () => {
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_2.json',
        vi.fn().mockResolvedValue(JSON.stringify(UNKNOWN_TOP_LEVEL_KEY))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      const drift = result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT');
      expect(drift).toBeDefined();
      expect(drift?.severity).toBe('error');
      // The good shard's data is not silently discarded, just the drift is
      // surfaced loudly instead of being masked — followers_1 still parsed.
      expect(result.data.followers.has('validuser')).toBe(true);
    });

    it('reports a drifted wrapper AND drifted records when shards disagree', async () => {
      // followers is the only multi-shard required file, so it is the only
      // place the two failures can co-occur — one shard with a renamed
      // wrapper, another whose records changed, is one plausible Meta change.
      // The upload fails either way; what the second warning adds is the
      // diagnosis. "The records also changed" is what separates a global
      // format drift from a single mangled file.
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(UNKNOWN_TOP_LEVEL_KEY))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_2.json',
        vi.fn().mockResolvedValue(JSON.stringify([{ media_list_data: [] }]))
      );

      const result = await parseInstagramZipFile(
        new File(['test'], 'test.zip', { type: 'application/zip' })
      );

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT')).toBeDefined();
      expect(result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWERS')).toBeDefined();
      // The wrapper failure is the graver diagnosis and stays first, because
      // both hasMinimalData consumers report the FIRST error warning.
      expect(result.warnings.find(w => w.severity === 'error')?.code).toBe(
        'INVALID_FOLLOWERS_FORMAT'
      );
      expect(result.hasMinimalData).toBe(false);
    });

    it('accepts a single bare entry object without INVALID_FOLLOWERS_FORMAT (GH#21 Task 2)', async () => {
      // followers_*.json has not been observed to drift into this shape, but
      // it shared the same Array.isArray ladder the optional files did — this
      // pins that the shared resolveEntryList fix reaches it too.
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE[0]))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      const result = await parseInstagramZipFile(mockFile);

      expect(result.warnings.find(w => w.code === 'INVALID_FOLLOWERS_FORMAT')).toBeUndefined();
      expect(result.data.followers.has('validuser')).toBe(true);
    });
  });
});
