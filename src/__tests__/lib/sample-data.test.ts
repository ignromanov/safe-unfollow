/**
 * Sample Data Tests
 *
 * Tests for loading pre-built sample data snapshot from public/sample-data.json
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  generateAndStoreSampleData,
  clearSampleData,
  hasSampleData,
  getSampleFileHash,
  SAMPLE_DATE_SOURCES,
} from '@/lib/sample-data';
import { TIME_BASED_BADGES } from '@/lib/indexeddb/indexeddb-schema';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import type { AccountBadges, BadgeKey } from '@/core/types';

// Mock IndexedDB service
vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: {
    getFileMetadata: vi.fn(),
    saveFileMetadata: vi.fn(),
    storeAllAccounts: vi.fn(),
    clearFile: vi.fn(),
  },
}));

// Mock sample data snapshot (subset for testing)
const mockSampleAccounts: AccountBadges[] = [
  {
    username: 'alex_photo1',
    badges: { mutuals: true, following: 1704067200, followers: 1704067200 },
  },
  {
    username: 'emma_travel2',
    badges: { mutuals: true, following: 1704063600, followers: 1704063600 },
  },
  { username: 'john_fitness3', badges: { following: 1704060000 } },
  { username: 'sarah_art4', badges: { followers: 1704056400 } },
  { username: 'mike_music5', badges: { notFollowingBack: true, following: 1704052800 } },
  { username: 'lisa_tech6', badges: { notFollowedBack: true, followers: 1704049200 } },
  { username: 'david_food7', badges: { unfollowed: 1704045600 } },
  { username: 'anna_yoga8', badges: { pending: 1704042000, following: 1704042000 } },
  { username: 'chris_design9', badges: { restricted: 1704038400 } },
  { username: 'kate_coffee10', badges: { dismissed: 1704034800 } },
];

const mockSnapshot = {
  version: 1,
  generatedAt: '2024-01-01T00:00:00.000Z',
  accountCount: mockSampleAccounts.length,
  accounts: mockSampleAccounts,
};

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Sample Data Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetch returns mock snapshot
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSnapshot),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateAndStoreSampleData', () => {
    it('should fetch and store sample data when none exists', async () => {
      // Mock no existing data
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);

      const result = await generateAndStoreSampleData();

      // Should fetch from correct URL
      expect(mockFetch).toHaveBeenCalledWith('/sample-data.json');

      // Should return file hash and account count
      expect(result.fileHash).toBe(getSampleFileHash());
      expect(result.accountCount).toBe(mockSampleAccounts.length);

      // Should save metadata
      expect(indexedDBService.saveFileMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          fileHash: getSampleFileHash(),
          fileName: 'Sample Data (Demo)',
          accountCount: mockSampleAccounts.length,
        })
      );

      // Should store accounts from snapshot
      expect(indexedDBService.storeAllAccounts).toHaveBeenCalledWith(
        getSampleFileHash(),
        mockSampleAccounts,
        SAMPLE_DATE_SOURCES
      );
    });

    const existingMetadata = {
      fileHash: getSampleFileHash(),
      fileName: 'Sample Data (Demo)',
      fileSize: 0,
      uploadDate: new Date(),
      accountCount: 1180,
      lastAccessed: Date.now(),
      version: 2,
      datesStored: true,
      dateZones: { following: 'utc' } as const,
    };

    it('rebuilds sample data stored before dates were persisted (GH#285)', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue({
        ...existingMetadata,
        dateZones: undefined,
      });

      await generateAndStoreSampleData();

      expect(indexedDBService.clearFile).toHaveBeenCalledWith(getSampleFileHash());
      expect(indexedDBService.storeAllAccounts).toHaveBeenCalledTimes(1);
      expect(indexedDBService.storeAllAccounts).toHaveBeenCalledWith(
        getSampleFileHash(),
        expect.any(Array),
        SAMPLE_DATE_SOURCES
      );
    });

    it('every time-based badge is utc in the sample sources', () => {
      expect(SAMPLE_DATE_SOURCES).toEqual(
        Object.fromEntries(TIME_BASED_BADGES.map(badge => [badge, 'utc']))
      );
    });

    it('should return existing metadata when sample data already exists', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(existingMetadata);

      const result = await generateAndStoreSampleData();

      // Should return existing data without fetching
      expect(result.fileHash).toBe(getSampleFileHash());
      expect(result.accountCount).toBe(1180);

      // Should not fetch
      expect(mockFetch).not.toHaveBeenCalled();

      // Should not save new data
      expect(indexedDBService.saveFileMetadata).not.toHaveBeenCalled();
      expect(indexedDBService.storeAllAccounts).not.toHaveBeenCalled();
    });

    it('should throw on fetch error', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(generateAndStoreSampleData()).rejects.toThrow(
        'Failed to fetch sample data: 404 Not Found'
      );
    });

    it('should throw on invalid snapshot format', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: 1 }), // Missing accounts array
      });

      await expect(generateAndStoreSampleData()).rejects.toThrow(
        'Invalid sample data format: missing accounts array'
      );
    });

    it('should store accounts with correct badge types', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);

      await generateAndStoreSampleData();

      const storeCall = vi.mocked(indexedDBService.storeAllAccounts).mock.calls[0];
      const accounts = storeCall?.[1] as AccountBadges[];

      expect(accounts).toBeDefined();

      // Count badges
      const badgeCounts: Record<string, number> = {};
      accounts.forEach(account => {
        Object.keys(account.badges).forEach(badge => {
          badgeCounts[badge] = (badgeCounts[badge] || 0) + 1;
        });
      });

      // Should have various badge types from mock data
      const expectedBadges: BadgeKey[] = [
        'following',
        'followers',
        'mutuals',
        'notFollowingBack',
        'unfollowed',
      ];
      expectedBadges.forEach(badge => {
        expect(badgeCounts[badge]).toBeGreaterThan(0);
      });
    });

    it('should have unique usernames in snapshot', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);

      await generateAndStoreSampleData();

      const storeCall = vi.mocked(indexedDBService.storeAllAccounts).mock.calls[0];
      const accounts = storeCall?.[1] as AccountBadges[];

      expect(accounts).toBeDefined();

      // Check uniqueness
      const usernames = accounts.map(a => a.username);
      const uniqueUsernames = new Set(usernames);
      expect(uniqueUsernames.size).toBe(usernames.length);
    });
  });

  describe('clearSampleData', () => {
    it('should clear sample data from IndexedDB', async () => {
      await clearSampleData();

      expect(indexedDBService.clearFile).toHaveBeenCalledWith(getSampleFileHash());
    });
  });

  describe('hasSampleData', () => {
    it('should return true when sample data exists', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue({
        fileHash: getSampleFileHash(),
        fileName: 'Sample Data (Demo)',
        fileSize: 0,
        uploadDate: new Date(),
        accountCount: 1180,
        lastAccessed: Date.now(),
        version: 2,
      });

      const result = await hasSampleData();
      expect(result).toBe(true);
    });

    it('should return false when sample data does not exist', async () => {
      vi.mocked(indexedDBService.getFileMetadata).mockResolvedValue(null);

      const result = await hasSampleData();
      expect(result).toBe(false);
    });
  });

  describe('getSampleFileHash', () => {
    it('should return consistent hash', () => {
      const hash1 = getSampleFileHash();
      const hash2 = getSampleFileHash();

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sample-/);
    });
  });
});
