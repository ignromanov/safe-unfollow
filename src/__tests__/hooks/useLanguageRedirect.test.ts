import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageRedirect } from '@/hooks/useLanguageRedirect';
import type { SupportedLanguage } from '@/config/languages';

// Mock react-router-dom
const mockLocation = { pathname: '/' };
vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
}));

// Mock store
const mockSetLanguage = vi.fn();
let mockStoreState = {
  language: 'en' as SupportedLanguage,
  setLanguage: mockSetLanguage,
  _hasHydrated: true,
};

vi.mock('@/lib/store', () => ({
  useAppStore: () => mockStoreState,
}));

/**
 * NOTE: The actual redirect logic is now in index.html (early script)
 * This hook only syncs Zustand store with URL language for persistence.
 *
 * Early redirect (index.html):
 * - Runs BEFORE React loads
 * - Handles first visit browser language detection
 * - Handles returning user stored preference
 * - No hydration mismatch possible
 *
 * This hook (useLanguageRedirect):
 * - Syncs store.language when URL changes
 * - For localStorage persistence
 * - Edge case: browser back/forward navigation
 */
describe('useLanguageRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockLocation.pathname = '/';
    mockStoreState = {
      language: 'en',
      setLanguage: mockSetLanguage,
      _hasHydrated: true,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hydration', () => {
    it('should not sync when store is not hydrated', () => {
      mockStoreState._hasHydrated = false;
      mockLocation.pathname = '/ru/sample';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).not.toHaveBeenCalled();
    });

    it('should sync after store is hydrated', () => {
      mockStoreState._hasHydrated = true;
      mockStoreState.language = 'en';
      mockLocation.pathname = '/ru/sample';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });
  });

  describe('store sync with URL', () => {
    it('should sync store when URL has different language', () => {
      mockStoreState.language = 'en';
      mockLocation.pathname = '/es/upload';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });

    it('should not call setLanguage when URL matches store', () => {
      mockStoreState.language = 'ru';
      mockLocation.pathname = '/ru/sample';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).not.toHaveBeenCalled();
    });

    it('should detect English from root path', () => {
      mockStoreState.language = 'ru';
      mockLocation.pathname = '/sample';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should detect English from exact root', () => {
      mockStoreState.language = 'de';
      mockLocation.pathname = '/';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('language detection from path', () => {
    it.each([
      ['/es', 'es'],
      ['/es/', 'es'],
      ['/es/sample', 'es'],
      ['/ru/upload', 'ru'],
      ['/de/results', 'de'],
      ['/fr/privacy', 'fr'],
      ['/ja/sample', 'ja'],
      ['/ar', 'ar'],
    ])('should detect %s as %s', (pathname, expectedLang) => {
      mockStoreState.language = 'en';
      mockLocation.pathname = pathname;

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith(expectedLang);
    });

    it.each([
      ['/', 'en'],
      ['/sample', 'en'],
      ['/upload', 'en'],
      ['/results', 'en'],
    ])('should detect %s as English', (pathname, expectedLang) => {
      mockStoreState.language = 'ru';
      mockLocation.pathname = pathname;

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      expect(mockSetLanguage).toHaveBeenCalledWith(expectedLang);
    });
  });

  describe('no redirect behavior', () => {
    it('should NOT trigger window.location.href (redirect is in index.html now)', () => {
      const originalHref = window.location.href;
      mockStoreState.language = 'en';
      mockLocation.pathname = '/';

      renderHook(() => useLanguageRedirect());
      act(() => {
        vi.runAllTimers();
      });

      // Hook should NOT modify window.location.href
      expect(window.location.href).toBe(originalHref);
    });
  });
});
