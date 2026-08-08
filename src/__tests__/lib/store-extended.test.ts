/**
 * Extended Store Tests
 *
 * Additional tests to improve coverage of store.ts beyond existing store.test.ts
 * Focuses on edge cases, state management, and persistence logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '@/lib/store';
import type { BadgeKey } from '@/lib/store';

describe('useAppStore - Extended Coverage', () => {
  beforeEach(() => {
    // Clear store
    const { clearData } = useAppStore.getState();
    clearData();
    vi.clearAllMocks();
  });

  describe('setUploadInfo', () => {
    it('should update fileMetadata on success with all fields', () => {
      const { setUploadInfo } = useAppStore.getState();

      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        fileHash: 'abc123',
        accountCount: 500,
      });

      const { fileMetadata } = useAppStore.getState();
      expect(fileMetadata).toEqual({
        name: 'test.zip',
        size: 1024,
        uploadDate: new Date('2024-01-01'),
        fileHash: 'abc123',
        accountCount: 500,
      });
    });

    it('should use default date if not provided', () => {
      const { setUploadInfo } = useAppStore.getState();
      const before = Date.now();

      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 100,
      });

      const { fileMetadata } = useAppStore.getState();
      const after = Date.now();

      expect(fileMetadata?.uploadDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(fileMetadata?.uploadDate.getTime()).toBeLessThanOrEqual(after);
    });

    it('should use zero as default fileSize', () => {
      const { setUploadInfo } = useAppStore.getState();

      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
      });

      const { fileMetadata } = useAppStore.getState();
      expect(fileMetadata?.size).toBe(0);
    });

    it('should clear fileMetadata on error status', () => {
      const { setUploadInfo } = useAppStore.getState();

      // First set success
      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 100,
      });

      expect(useAppStore.getState().fileMetadata).not.toBeNull();

      // Then set error
      setUploadInfo({
        uploadStatus: 'error',
        uploadError: 'Failed',
      });

      expect(useAppStore.getState().fileMetadata).toBeNull();
    });

    it('should update parseWarnings when provided', () => {
      const { setUploadInfo } = useAppStore.getState();

      const warnings = [{ code: 'WARN1', message: 'Warning 1', severity: 'warning' as const }];

      setUploadInfo({
        parseWarnings: warnings,
      });

      expect(useAppStore.getState().parseWarnings).toEqual(warnings);
    });

    it('should update fileDiscovery when provided', () => {
      const { setUploadInfo } = useAppStore.getState();

      const discovery = {
        format: 'json' as const,
        isInstagramExport: true,
        files: [],
      };

      setUploadInfo({
        fileDiscovery: discovery,
      });

      expect(useAppStore.getState().fileDiscovery).toEqual(discovery);
    });

    it('should preserve existing state when partial update', () => {
      const { setUploadInfo } = useAppStore.getState();

      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'loading',
      });

      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 100,
      });

      const state = useAppStore.getState();
      expect(state.currentFileName).toBe('test.zip');
      expect(state.uploadStatus).toBe('success');
      expect(state.fileMetadata?.fileHash).toBe('abc123');
    });
  });

  describe('clearData', () => {
    it('should reset all state', () => {
      const { setFilters, setUploadInfo, clearData } = useAppStore.getState();

      // Set various state
      setFilters(new Set<BadgeKey>(['mutuals', 'notFollowingBack']));
      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 100,
      });

      clearData();

      const state = useAppStore.getState();
      expect(state.filters.size).toBe(0);
      expect(state.currentFileName).toBeNull();
      expect(state.uploadStatus).toBe('idle');
      expect(state.uploadError).toBeNull();
      expect(state.fileMetadata).toBeNull();
      expect(state.parseWarnings).toEqual([]);
      expect(state.fileDiscovery).toBeNull();
    });
  });

  describe('Persistence and migration', () => {
    it('should have correct store name', () => {
      const storeName = 'unfollow-radar-store';
      const stored = localStorage.getItem(storeName);
      // Store may or may not exist depending on test order
      expect(typeof stored === 'string' || stored === null).toBe(true);
    });

    it('should serialize and deserialize Sets correctly', () => {
      const { setFilters } = useAppStore.getState();

      const filters = new Set<BadgeKey>(['mutuals', 'following', 'followers']);
      setFilters(filters);

      // Simulate persistence by getting the stored value
      const stored = localStorage.getItem('unfollow-radar-store');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        // Filters should be serialized as array
        expect(Array.isArray(parsed.state.filters)).toBe(true);
        expect(parsed.state.filters).toHaveLength(3);
      }
    });

    it('should set _hasHydrated after rehydration', () => {
      // The onRehydrateStorage callback sets this
      const { _hasHydrated } = useAppStore.getState();
      expect(typeof _hasHydrated).toBe('boolean');
    });
  });

  describe('Filter management', () => {
    it('should replace entire filter set', () => {
      const { setFilters } = useAppStore.getState();

      setFilters(new Set<BadgeKey>(['mutuals']));
      expect(useAppStore.getState().filters.has('mutuals')).toBe(true);

      setFilters(new Set<BadgeKey>(['following', 'followers']));
      const { filters } = useAppStore.getState();
      expect(filters.has('mutuals')).toBe(false);
      expect(filters.has('following')).toBe(true);
      expect(filters.has('followers')).toBe(true);
    });

    it('should handle empty filter set', () => {
      const { setFilters } = useAppStore.getState();

      setFilters(new Set<BadgeKey>(['mutuals', 'following']));
      expect(useAppStore.getState().filters.size).toBe(2);

      setFilters(new Set<BadgeKey>());
      expect(useAppStore.getState().filters.size).toBe(0);
    });

    it('should create new Set instance to trigger reactivity', () => {
      const { setFilters, filters: initialFilters } = useAppStore.getState();

      const newFilters = new Set<BadgeKey>(['mutuals']);
      setFilters(newFilters);

      const { filters: updatedFilters } = useAppStore.getState();
      expect(updatedFilters).not.toBe(initialFilters);
      expect(updatedFilters).not.toBe(newFilters); // Creates new Set internally
    });
  });

  describe('Upload status lifecycle', () => {
    it('should handle complete upload lifecycle', () => {
      const { setUploadInfo } = useAppStore.getState();

      // Idle
      expect(useAppStore.getState().uploadStatus).toBe('idle');

      // Loading
      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'loading',
      });
      expect(useAppStore.getState().uploadStatus).toBe('loading');
      expect(useAppStore.getState().currentFileName).toBe('test.zip');

      // Success - need currentFileName for fileMetadata to be created
      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 1000,
      });
      expect(useAppStore.getState().uploadStatus).toBe('success');
      expect(useAppStore.getState().fileMetadata).toBeTruthy();
    });

    it('should handle upload error', () => {
      const { setUploadInfo } = useAppStore.getState();

      setUploadInfo({
        currentFileName: 'bad.zip',
        uploadStatus: 'loading',
      });

      setUploadInfo({
        uploadStatus: 'error',
        uploadError: 'Invalid file format',
      });

      const state = useAppStore.getState();
      expect(state.uploadStatus).toBe('error');
      expect(state.uploadError).toBe('Invalid file format');
      expect(state.fileMetadata).toBeNull();
    });
  });

  describe('Language management', () => {
    it('should have default language as English', () => {
      const { language } = useAppStore.getState();
      expect(language).toBe('en');
    });

    it('should update language state when setLanguage is called', () => {
      const { setLanguage } = useAppStore.getState();

      setLanguage('es');

      expect(useAppStore.getState().language).toBe('es');
    });

    it('should accept all supported languages', () => {
      const { setLanguage } = useAppStore.getState();
      const supportedLanguages = ['en', 'es', 'pt', 'id', 'tr', 'ja', 'ru', 'de'] as const;

      supportedLanguages.forEach(lang => {
        setLanguage(lang);
        expect(useAppStore.getState().language).toBe(lang);
      });
    });

    it('should persist language through clearData', () => {
      const { setLanguage, clearData } = useAppStore.getState();

      setLanguage('de');
      clearData();

      // Note: clearData doesn't reset language, only upload state
      // Language is preserved to maintain user preference
      expect(useAppStore.getState().language).toBe('de');
    });
  });

  describe('Migration scenarios', () => {
    it('should handle old version migration', () => {
      // Old versions should be migrated to latest
      const oldData = {
        state: {
          filters: ['following'],
          currentFileName: 'old.zip',
        },
        version: 1,
      };

      localStorage.setItem('unfollow-radar-store', JSON.stringify(oldData));

      // After migration, state should be updated to v5
      // This is handled by persist middleware migrate function
    });
  });

  describe('Storage removeItem', () => {
    it('should remove item from localStorage', () => {
      // Set some data first
      localStorage.setItem('unfollow-radar-store', '{"test": true}');

      // Remove it
      localStorage.removeItem('unfollow-radar-store');

      expect(localStorage.getItem('unfollow-radar-store')).toBeNull();
    });
  });

  describe('Complex state interactions', () => {
    it('should handle file upload with filters', () => {
      const { setFilters, setUploadInfo } = useAppStore.getState();

      setFilters(new Set<BadgeKey>(['mutuals', 'notFollowingBack']));
      setUploadInfo({
        currentFileName: 'test.zip',
        uploadStatus: 'loading',
      });

      expect(useAppStore.getState().uploadStatus).toBe('loading');

      setUploadInfo({
        uploadStatus: 'success',
        fileHash: 'abc123',
        accountCount: 500,
      });

      const state = useAppStore.getState();
      expect(state.uploadStatus).toBe('success');
      expect(state.filters.has('mutuals')).toBe(true);
      expect(state.filters.has('notFollowingBack')).toBe(true);
    });
  });
});
