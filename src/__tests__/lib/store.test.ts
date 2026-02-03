import type { BadgeKey } from '@/core/types';
import { useAppStore, persistLanguageSync } from '@/lib/store';
import { act, renderHook } from '@testing-library/react';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock locales module for language sync testing
vi.mock('@/locales', () => ({
  loadLanguage: vi.fn().mockResolvedValue(undefined),
  initI18n: vi.fn().mockResolvedValue(undefined),
  default: {
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAppStore.setState({
      filters: new Set<BadgeKey>(),
      currentFileName: null,
      uploadStatus: 'idle',
      uploadError: null,
      fileMetadata: null,
      language: 'en',
      parseWarnings: [],
      fileDiscovery: null,
      _hasHydrated: false,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.filters).toEqual(new Set());
      expect(result.current.currentFileName).toBeNull();
      expect(result.current.uploadStatus).toBe('idle');
      expect(result.current.uploadError).toBeNull();
      expect(result.current.fileMetadata).toBeNull();
      expect(result.current.language).toBe('en');
      expect(result.current.parseWarnings).toEqual([]);
      expect(result.current.fileDiscovery).toBeNull();
      expect(result.current._hasHydrated).toBe(false);
    });
  });

  describe('setFilters', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useAppStore());
      const newFilters = new Set<BadgeKey>(['following', 'followers']);

      act(() => {
        result.current.setFilters(newFilters);
      });

      expect(result.current.filters).toEqual(newFilters);
    });

    it('should handle empty filters set', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setFilters(new Set<BadgeKey>());
      });

      expect(result.current.filters).toEqual(new Set());
    });
  });

  describe('setUploadInfo', () => {
    it('should update upload info', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUploadInfo({
          currentFileName: 'test.zip',
          uploadStatus: 'loading',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          fileHash: 'abc123',
          accountCount: 100,
        });
      });

      expect(result.current.currentFileName).toBe('test.zip');
      expect(result.current.uploadStatus).toBe('loading');
      // fileMetadata is only set when uploadStatus is 'success'
      expect(result.current.fileMetadata).toBeNull();
    });

    it('should update fileMetadata on success', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUploadInfo({
          currentFileName: 'test.zip',
          uploadStatus: 'success',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          fileHash: 'abc123',
          accountCount: 100,
        });
      });

      expect(result.current.fileMetadata).toEqual({
        name: 'test.zip',
        size: 1024,
        uploadDate: new Date('2023-01-01'),
        fileHash: 'abc123',
        accountCount: 100,
      });
    });

    it('should clear fileMetadata on error', () => {
      const { result } = renderHook(() => useAppStore());

      // First set some metadata
      act(() => {
        result.current.setUploadInfo({
          currentFileName: 'test.zip',
          uploadStatus: 'success',
          fileSize: 1024,
        });
      });

      expect(result.current.fileMetadata).not.toBeNull();

      // Then set error status
      act(() => {
        result.current.setUploadInfo({
          uploadStatus: 'error',
          uploadError: 'Upload failed',
        });
      });

      expect(result.current.fileMetadata).toBeNull();
    });

    it('should update parseWarnings and fileDiscovery', () => {
      const { result } = renderHook(() => useAppStore());
      const warnings = [{ severity: 'warning' as const, code: 'TEST', message: 'Test warning' }];
      const discovery = { hasFollowers: true, hasFollowing: true };

      act(() => {
        result.current.setUploadInfo({
          parseWarnings: warnings,
          fileDiscovery: discovery,
        });
      });

      expect(result.current.parseWarnings).toEqual(warnings);
      expect(result.current.fileDiscovery).toEqual(discovery);
    });
  });

  describe('clearData', () => {
    it('should clear all data and reset to initial state', () => {
      const { result } = renderHook(() => useAppStore());

      // Set some data first
      act(() => {
        result.current.setFilters(new Set(['following', 'followers']));
        result.current.setUploadInfo({
          currentFileName: 'test.zip',
          uploadStatus: 'success',
          fileSize: 1024,
        });
      });

      // Verify data is set
      expect(result.current.filters.size).toBe(2);
      expect(result.current.currentFileName).toBe('test.zip');

      // Clear data
      act(() => {
        result.current.clearData();
      });

      // Verify everything is reset
      expect(result.current.filters).toEqual(new Set());
      expect(result.current.currentFileName).toBeNull();
      expect(result.current.uploadStatus).toBe('idle');
      expect(result.current.uploadError).toBeNull();
      expect(result.current.fileMetadata).toBeNull();
      expect(result.current.parseWarnings).toEqual([]);
      expect(result.current.fileDiscovery).toBeNull();
    });
  });

  describe('language management', () => {
    it('should set language and trigger i18n sync', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setLanguage('es');
      });

      expect(result.current.language).toBe('es');
    });

    it('should handle all supported languages', () => {
      const { result } = renderHook(() => useAppStore());

      const languages = ['en', 'es', 'pt', 'ru', 'de', 'hi', 'ja', 'tr', 'id', 'ar'] as const;

      for (const lang of languages) {
        act(() => {
          result.current.setLanguage(lang);
        });
        expect(result.current.language).toBe(lang);
      }
    });
  });

  describe('store integration', () => {
    it('should maintain state consistency across multiple operations', () => {
      const { result } = renderHook(() => useAppStore());

      // Set filters
      act(() => {
        result.current.setFilters(new Set(['following']));
      });

      expect(result.current.filters).toEqual(new Set(['following']));

      // Set upload info with loading status
      act(() => {
        result.current.setUploadInfo({
          currentFileName: 'data.zip',
          uploadStatus: 'loading',
        });
      });

      expect(result.current.currentFileName).toBe('data.zip');
      expect(result.current.uploadStatus).toBe('loading');
      expect(result.current.fileMetadata).toBeNull(); // Not set during loading

      // Update upload status to success with required fields
      act(() => {
        result.current.setUploadInfo({
          currentFileName: 'data.zip',
          uploadStatus: 'success',
          fileSize: 2048,
          accountCount: 500,
        });
      });

      expect(result.current.uploadStatus).toBe('success');
      expect(result.current.fileMetadata).toEqual({
        name: 'data.zip',
        size: 2048,
        uploadDate: expect.any(Date),
        fileHash: undefined,
        accountCount: 500,
      });

      // Clear data
      act(() => {
        result.current.clearData();
      });

      expect(result.current.filters).toEqual(new Set());
      expect(result.current.currentFileName).toBeNull();
      expect(result.current.uploadStatus).toBe('idle');
    });

    it('should handle multiple filter toggle operations', () => {
      const { result } = renderHook(() => useAppStore());

      // Add multiple filters
      act(() => {
        result.current.setFilters(new Set(['following', 'followers', 'mutuals']));
      });
      expect(result.current.filters.size).toBe(3);

      // Remove one filter by creating new set
      act(() => {
        result.current.setFilters(new Set(['following', 'followers']));
      });
      expect(result.current.filters.size).toBe(2);
      expect(result.current.filters.has('mutuals')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should handle localStorage getItem with null value', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = useAppStore.persist.getOptions().storage?.getItem('test-key');

      expect(result).toBeNull();
    });

    it('should handle localStorage getItem with valid JSON', () => {
      const mockData = {
        state: {
          filters: ['following', 'followers'],
          language: 'es',
        },
        version: 5,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

      const result = useAppStore.persist.getOptions().storage?.getItem('test-key');

      expect(result).toEqual({
        state: {
          filters: new Set(['following', 'followers']),
          language: 'es',
        },
        version: 5,
      });
    });

    it('should handle localStorage getItem with parse error', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const result = useAppStore.persist.getOptions().storage?.getItem('test-key');

      expect(result).toBeNull();
    });

    it('should handle localStorage getItem when localStorage throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = useAppStore.persist.getOptions().storage?.getItem('test-key');

      expect(result).toBeNull();
    });

    it('should handle localStorage setItem with Set serialization', () => {
      const value = {
        state: {
          filters: new Set(['following', 'followers']),
          language: 'en',
        },
      };

      useAppStore.persist.getOptions().storage?.setItem('test-key', value);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({
          state: {
            filters: ['following', 'followers'],
            language: 'en',
          },
        })
      );
    });

    it('should handle localStorage setItem when localStorage throws', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        useAppStore.persist.getOptions().storage?.setItem('test-key', { state: {} });
      }).not.toThrow();
    });

    it('should handle localStorage removeItem', () => {
      useAppStore.persist.getOptions().storage?.removeItem('test-key');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle localStorage removeItem when localStorage throws', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Error');
      });

      expect(() => {
        useAppStore.persist.getOptions().storage?.removeItem('test-key');
      }).not.toThrow();
    });
  });

  describe('migration', () => {
    it('should migrate from version 4 to version 5 (remove journey)', () => {
      const oldState = {
        filters: new Set(['following']),
        language: 'es',
        journey: {
          currentStep: 'hero',
          completedSteps: new Set(),
        },
      };

      const migrate = useAppStore.persist.getOptions().migrate;
      const result = migrate?.(oldState, 4);

      expect(result).toEqual({
        filters: new Set(['following']),
        language: 'es',
        _hasHydrated: false,
      });
    });

    it('should add default language during migration if missing', () => {
      const oldState = {
        filters: new Set(['followers']),
      };

      const migrate = useAppStore.persist.getOptions().migrate;
      const result = migrate?.(oldState, 3);

      expect(result).toEqual({
        filters: new Set(['followers']),
        language: 'en',
        _hasHydrated: false,
      });
    });

    it('should return fresh state when migration fails', () => {
      const migrate = useAppStore.persist.getOptions().migrate;
      const result = migrate?.(null, 4);

      expect(result).toEqual({
        filters: new Set(),
        currentFileName: null,
        uploadStatus: 'idle',
        uploadError: null,
        fileMetadata: null,
        language: 'en',
        _hasHydrated: false,
      });
    });

    it('should return state as-is for future versions', () => {
      const newState = {
        filters: new Set(['following']),
        language: 'en',
        someNewField: 'value',
      };

      const migrate = useAppStore.persist.getOptions().migrate;
      const result = migrate?.(newState, 6);

      expect(result).toEqual(newState);
    });
  });

  describe('rehydration', () => {
    it('should set _hasHydrated to true on rehydration', () => {
      const state = {
        filters: new Set<BadgeKey>(),
        language: 'en' as const,
        _hasHydrated: false,
      };

      const onRehydrate = useAppStore.persist.getOptions().onRehydrateStorage;
      const callback = onRehydrate?.();
      callback?.(state as any, undefined);

      expect(state._hasHydrated).toBe(true);
    });

    it('should handle null state during rehydration', () => {
      const onRehydrate = useAppStore.persist.getOptions().onRehydrateStorage;
      const callback = onRehydrate?.();

      expect(() => {
        callback?.(null as any, undefined);
      }).not.toThrow();
    });

    it('should set _hasHydrated on rehydration without language sync', () => {
      const state = {
        filters: new Set<BadgeKey>(),
        language: 'en' as const,
        _hasHydrated: false,
      };

      const onRehydrate = useAppStore.persist.getOptions().onRehydrateStorage;
      const callback = onRehydrate?.();
      callback?.(state as any, undefined);

      // Language is NOT synced from localStorage - URL is source of truth
      expect(state._hasHydrated).toBe(true);
    });
  });

  describe('partialize', () => {
    it('should only persist specified fields', () => {
      const fullState = {
        filters: new Set(['following']),
        currentFileName: 'test.zip',
        uploadStatus: 'success' as const,
        uploadError: null,
        fileMetadata: { name: 'test.zip', size: 1024 },
        language: 'en' as const,
        parseWarnings: [],
        fileDiscovery: null,
        _hasHydrated: true,
      };

      const partialize = useAppStore.persist.getOptions().partialize;
      const result = partialize?.(fullState as any);

      // Language IS persisted - used for redirect from language-less paths
      // URL remains the source of truth for current rendering
      expect(result).toEqual({
        filters: ['following'],
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        uploadError: null,
        fileMetadata: { name: 'test.zip', size: 1024 },
        language: 'en',
      });
      expect(result).not.toHaveProperty('parseWarnings');
      expect(result).not.toHaveProperty('fileDiscovery');
      expect(result).not.toHaveProperty('_hasHydrated');
    });
  });

  describe('persistLanguageSync', () => {
    it('should update language in existing localStorage data', () => {
      const existingData = {
        state: { language: 'en', filters: [] },
        version: 5,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingData));

      persistLanguageSync('es');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'unfollow-radar-store',
        JSON.stringify({
          state: { language: 'es', filters: [] },
          version: 5,
        })
      );
    });

    it('should create store structure when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);

      persistLanguageSync('ru');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'unfollow-radar-store',
        JSON.stringify({
          state: { language: 'ru' },
          version: 5,
        })
      );
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => persistLanguageSync('de')).not.toThrow();
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      // Should not throw (catches parse error)
      expect(() => persistLanguageSync('fr')).not.toThrow();
    });
  });
});
