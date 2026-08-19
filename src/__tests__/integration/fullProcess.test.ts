import { vi, beforeEach } from 'vitest';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { buildAccountBadgeIndex, filterAccountsByBadges } from '@/core/badges';
import {
  generateFollowingData,
  generateFollowersData,
  generatePendingRequestsData,
  generateRestrictedData,
  generateCloseFriendsData,
  generateUnfollowedData,
  generateDismissedData,
  TEST_ACCOUNTS,
  EXPECTED_BADGE_COUNTS,
} from '../fixtures/testData';
import type { BadgeKey } from '@/core/types';

// Hoisted mock setup
const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

// Mock JSZip
let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', () => ({
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

describe('Full Process Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete data processing pipeline', () => {
    it('should process ZIP file and generate correct badge counts', async () => {
      // Create mock JSZip instance
      mockZipInstance = new MockZipArchive();

      // Add mock files to the ZIP
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateFollowingData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateFollowersData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/pending_follow_requests.json',
        vi.fn().mockResolvedValue(JSON.stringify(generatePendingRequestsData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/permanent_follow_requests.json',
        vi.fn().mockResolvedValue(JSON.stringify([]))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/restricted_profiles.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateRestrictedData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/close_friends.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateCloseFriendsData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/recently_unfollowed_profiles.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateUnfollowedData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/removed_suggestions.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateDismissedData()))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });

      // Step 1: Parse ZIP file (now returns ParseResult)
      const parseResult = await parseInstagramZipFile(mockFile);
      expect(parseResult.hasMinimalData).toBe(true);

      // Step 2: Build badge index from parseResult.data
      const badgeIndex = buildAccountBadgeIndex(parseResult.data);

      // Step 3: Verify badge counts
      const actualCounts = {
        following: badgeIndex.filter(acc => acc.badges.following).length,
        followers: badgeIndex.filter(acc => acc.badges.followers).length,
        mutuals: badgeIndex.filter(acc => acc.badges.mutuals).length,
        notFollowingBack: badgeIndex.filter(acc => acc.badges.notFollowingBack).length,
        notFollowedBack: badgeIndex.filter(acc => acc.badges.notFollowedBack).length,
        pending: badgeIndex.filter(acc => acc.badges.pending).length,
        permanent: badgeIndex.filter(acc => acc.badges.permanent).length,
        restricted: badgeIndex.filter(acc => acc.badges.restricted).length,
        close: badgeIndex.filter(acc => acc.badges.close).length,
        unfollowed: badgeIndex.filter(acc => acc.badges.unfollowed).length,
        dismissed: badgeIndex.filter(acc => acc.badges.dismissed).length,
      };

      expect(actualCounts.following).toBe(EXPECTED_BADGE_COUNTS.following);
      expect(actualCounts.followers).toBe(EXPECTED_BADGE_COUNTS.followers);
      expect(actualCounts.mutuals).toBe(EXPECTED_BADGE_COUNTS.mutuals);
      expect(actualCounts.notFollowingBack).toBe(EXPECTED_BADGE_COUNTS.notFollowingBack);
      expect(actualCounts.notFollowedBack).toBe(EXPECTED_BADGE_COUNTS.notFollowedBack);
      expect(actualCounts.pending).toBe(EXPECTED_BADGE_COUNTS.pending);
      expect(actualCounts.restricted).toBe(EXPECTED_BADGE_COUNTS.restricted);
      expect(actualCounts.close).toBe(EXPECTED_BADGE_COUNTS.close);
      expect(actualCounts.unfollowed).toBe(EXPECTED_BADGE_COUNTS.unfollowed);
      expect(actualCounts.dismissed).toBe(EXPECTED_BADGE_COUNTS.dismissed);
    });

    it('should handle filtering workflow correctly', async () => {
      // Create mock JSZip instance
      mockZipInstance = new MockZipArchive();

      // Add mock files to the ZIP
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateFollowingData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/followers_1.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateFollowersData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/pending_follow_requests.json',
        vi.fn().mockResolvedValue(JSON.stringify(generatePendingRequestsData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/restricted_profiles.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateRestrictedData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/close_friends.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateCloseFriendsData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/recently_unfollowed_profiles.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateUnfollowedData()))
      );
      mockZipInstance._addFile(
        'connections/followers_and_following/removed_suggestions.json',
        vi.fn().mockResolvedValue(JSON.stringify(generateDismissedData()))
      );

      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });

      // Step 1: Parse and build index (now returns ParseResult)
      const parseResult = await parseInstagramZipFile(mockFile);
      expect(parseResult.hasMinimalData).toBe(true);
      const badgeIndex = buildAccountBadgeIndex(parseResult.data);

      // Step 2: Test various filtering scenarios

      // Filter by mutuals only
      const mutuals = filterAccountsByBadges(badgeIndex, new Set(['mutuals']));
      expect(mutuals).toHaveLength(TEST_ACCOUNTS.mutuals.length);
      mutuals.forEach(account => {
        expect(account.badges.mutuals).toBeTruthy();
      });

      // Filter by not following back
      const notFollowingBack = filterAccountsByBadges(badgeIndex, new Set(['notFollowingBack']));
      expect(notFollowingBack).toHaveLength(TEST_ACCOUNTS.notFollowingBack.length);
      notFollowingBack.forEach(account => {
        expect(account.badges.notFollowingBack).toBeTruthy();
      });

      // Filter by multiple badge types
      const multipleFilters = filterAccountsByBadges(
        badgeIndex,
        new Set(['mutuals', 'notFollowingBack'] as BadgeKey[])
      );
      expect(multipleFilters).toHaveLength(
        TEST_ACCOUNTS.mutuals.length + TEST_ACCOUNTS.notFollowingBack.length
      );

      // Filter by username query
      const aliceAccounts = filterAccountsByBadges(badgeIndex, new Set(['following']), 'alice');
      expect(aliceAccounts.length).toBeGreaterThan(0);
      aliceAccounts.forEach(account => {
        expect(account.username.toLowerCase()).toContain('alice');
      });

      // Filter by username query with specific badge
      const aliceMutuals = filterAccountsByBadges(badgeIndex, new Set(['mutuals']), 'alice');
      aliceMutuals.forEach(account => {
        expect(account.badges.mutuals).toBeTruthy();
        expect(account.username.toLowerCase()).toContain('alice');
      });
    });

    it('should handle edge cases in the pipeline', async () => {
      // Create mock JSZip instance
      mockZipInstance = new MockZipArchive();

      // Add minimal mock files to the ZIP
      mockZipInstance._addFile(
        'connections/followers_and_following/following.json',
        vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              title: 'single_user',
              string_list_data: [
                {
                  href: 'https://www.instagram.com/single_user/',
                  value: 'single_user',
                  timestamp: Date.now() / 1000,
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

      // Process minimal data (now returns ParseResult)
      const parseResult = await parseInstagramZipFile(mockFile);
      expect(parseResult.hasMinimalData).toBe(true);
      const badgeIndex = buildAccountBadgeIndex(parseResult.data);

      // Should have one account
      expect(badgeIndex).toHaveLength(1);
      expect(badgeIndex[0]!.username).toBe('single_user');
      expect(badgeIndex[0]!.badges.following).toBeTruthy();
      expect(badgeIndex[0]!.badges.followers).toBeFalsy();
      expect(badgeIndex[0]!.badges.notFollowingBack).toBeTruthy();

      // Test filtering with no results
      const noResults = filterAccountsByBadges(badgeIndex, new Set(['mutuals']));
      expect(noResults).toHaveLength(0);

      // Test filtering with query that matches
      const matchingQuery = filterAccountsByBadges(badgeIndex, new Set(['following']), 'single');
      expect(matchingQuery).toHaveLength(1);

      // Test filtering with query that doesn't match
      const nonMatchingQuery = filterAccountsByBadges(
        badgeIndex,
        new Set(['following']),
        'nonexistent'
      );
      expect(nonMatchingQuery).toHaveLength(0);
    });
  });
});
