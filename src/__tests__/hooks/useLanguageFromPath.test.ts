import { renderHook } from '@testing-library/react';
import { useLanguageFromPath } from '@/hooks/useLanguageFromPath';
import { useAppStore } from '@/lib/store';
import { useLocation } from 'react-router-dom';
import i18n, { initI18n, loadLanguage } from '@/locales';
import type { SupportedLanguage } from '@/config/languages';

// Mock dependencies
vi.mock('@/lib/store');
vi.mock('react-router-dom');
vi.mock('@/locales', async () => {
  const actual = await vi.importActual('@/locales');
  return {
    ...actual,
    default: {
      language: 'en',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
    initI18n: vi.fn().mockResolvedValue(undefined),
    loadLanguage: vi.fn().mockResolvedValue(undefined),
  };
});

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseLocation = vi.mocked(useLocation);
const mockInitI18n = vi.mocked(initI18n);
const mockLoadLanguage = vi.mocked(loadLanguage);

describe('useLanguageFromPath', () => {
  let mockSetLanguage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset DOM for each test
    document.head.innerHTML = '';
    document.documentElement.lang = 'en';

    mockSetLanguage = vi.fn();

    // Default mock implementations
    mockUseAppStore.mockReturnValue({
      language: 'en' as SupportedLanguage,
      setLanguage: mockSetLanguage,
    });

    mockUseLocation.mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    mockInitI18n.mockResolvedValue();
    mockLoadLanguage.mockResolvedValue();

    // Reset i18n mock
    (i18n as any).language = 'en';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('language detection from path', () => {
    it('should detect English from root path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence (even for default English)
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should detect Spanish from /es/ path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });

    it('should detect Russian from /ru/wizard path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ru/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });

    it('should detect Portuguese from /pt/upload path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/pt/upload',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('pt');
    });

    it('should detect German from /de/results path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/de/results',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('de');
    });

    it('should treat a retired locale prefix as English', () => {
      // /hi/* is redirected away at the edge, but the client must not resolve it
      // to a language either — a removed prefix has to read as English, not as an
      // unknown that leaves i18next on whatever was loaded last.
      mockUseLocation.mockReturnValue({
        pathname: '/hi/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'de' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should detect Indonesian from /id/privacy path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/id/privacy',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('id');
    });

    it('should detect Turkish from /tr/terms path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/tr/terms',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('tr');
    });

    it('should detect Japanese from /ja/sample path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ja/sample',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('ja');
    });

    it('should detect Arabic from /ar/ path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ar/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('ar');
    });
  });

  describe('language from route prop', () => {
    it('should use langFromRoute prop when provided', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath('es'));

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });

    it('should prioritize langFromRoute over path detection', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ru/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath('es'));

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });
  });

  describe('edge cases and invalid paths', () => {
    it('should default to English for invalid language code', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/invalid/path',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should default to English for path without language prefix', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should handle empty path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });

    it('should ignore query parameters', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '?foo=bar',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });

    it('should ignore hash', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ru/results',
        search: '',
        hash: '#section',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });

    it('should handle trailing slashes', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });
  });

  // Note: "hydration awareness" tests removed - hook now works immediately
  // URL is the source of truth, no dependency on _hasHydrated

  describe('language persistence', () => {
    it('should always call setLanguage to persist URL language', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('es');
    });

    it('should update store when path changes to different language', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      const { rerender } = renderHook(() => useLanguageFromPath());

      expect(mockSetLanguage).toHaveBeenCalledWith('es');

      // Change path to Russian
      mockUseLocation.mockReturnValue({
        pathname: '/ru/results',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockSetLanguage.mockClear();
      rerender();

      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });
  });

  describe('HTML lang attribute', () => {
    it('should update HTML lang attribute to Spanish', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(document.documentElement.lang).toBe('es');
    });

    it('should update HTML lang attribute to Russian', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ru/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'ru' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(document.documentElement.lang).toBe('ru');
    });

    it('should update HTML lang attribute when URL changes', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      const { rerender } = renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(document.documentElement.lang).toBe('es');

      // Change URL to Russian (HTML lang follows URL, not store)
      mockUseLocation.mockReturnValue({
        pathname: '/ru/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      rerender();
      vi.runAllTimers();

      expect(document.documentElement.lang).toBe('ru');
    });
  });

  describe('hreflang tags', () => {
    it('should create hreflang tags for root path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
      expect(hreflangLinks.length).toBeGreaterThan(0);
    });

    it('should include x-default hreflang', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const xDefault = document.querySelector('link[hreflang="x-default"]');
      expect(xDefault).toBeTruthy();
      expect(xDefault?.getAttribute('href')).toBe('https://safeunfollow.app/');
    });

    it('should create correct hreflang URLs for /wizard path', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const enLink = document.querySelector('link[hreflang="en"]');
      expect(enLink?.getAttribute('href')).toBe('https://safeunfollow.app/wizard');

      const esLink = document.querySelector('link[hreflang="es"]');
      expect(esLink?.getAttribute('href')).toBe('https://safeunfollow.app/es/wizard');

      const ruLink = document.querySelector('link[hreflang="ru"]');
      expect(ruLink?.getAttribute('href')).toBe('https://safeunfollow.app/ru/wizard');
    });

    it('should strip language prefix from path for hreflang generation', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const enLink = document.querySelector('link[hreflang="en"]');
      expect(enLink?.getAttribute('href')).toBe('https://safeunfollow.app/wizard');

      const esLink = document.querySelector('link[hreflang="es"]');
      expect(esLink?.getAttribute('href')).toBe('https://safeunfollow.app/es/wizard');
    });

    it('should replace existing hreflang tags with correct ones', () => {
      // Add some existing tags with wrong href
      const existingLink = document.createElement('link');
      existingLink.rel = 'alternate';
      existingLink.setAttribute('hreflang', 'fr');
      existingLink.href = 'https://example.com/fr'; // Wrong URL
      document.head.appendChild(existingLink);

      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      // Old tag should be replaced with correct href
      const frLink = document.querySelector('link[hreflang="fr"]');
      expect(frLink).not.toBeNull();
      expect(frLink?.getAttribute('href')).toBe('https://safeunfollow.app/fr/wizard');
    });

    it('should update hreflang tags when path changes', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      const { rerender } = renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      let enLink = document.querySelector('link[hreflang="en"]');
      expect(enLink?.getAttribute('href')).toBe('https://safeunfollow.app/wizard');

      // Change path
      mockUseLocation.mockReturnValue({
        pathname: '/upload',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      rerender();
      vi.runAllTimers();

      enLink = document.querySelector('link[hreflang="en"]');
      expect(enLink?.getAttribute('href')).toBe('https://safeunfollow.app/upload');
    });
  });

  describe('Open Graph locale meta tag', () => {
    it('should create og:locale meta tag for English', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const ogLocale = document.querySelector('meta[property="og:locale"]');
      expect(ogLocale?.getAttribute('content')).toBe('en_US');
    });

    it('should update og:locale for Spanish', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const ogLocale = document.querySelector('meta[property="og:locale"]');
      expect(ogLocale?.getAttribute('content')).toBe('es_ES');
    });

    it('should update og:locale for Russian', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/ru/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'ru' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const ogLocale = document.querySelector('meta[property="og:locale"]');
      expect(ogLocale?.getAttribute('content')).toBe('ru_RU');
    });

    it('should update og:locale for Portuguese', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/pt/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'pt' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const ogLocale = document.querySelector('meta[property="og:locale"]');
      expect(ogLocale?.getAttribute('content')).toBe('pt_BR');
    });

    it('should update existing og:locale tag', () => {
      // Create existing tag
      const existingOgLocale = document.createElement('meta');
      existingOgLocale.setAttribute('property', 'og:locale');
      existingOgLocale.setAttribute('content', 'en_US');
      document.head.appendChild(existingOgLocale);

      mockUseLocation.mockReturnValue({
        pathname: '/es/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      const ogLocaleTags = document.querySelectorAll('meta[property="og:locale"]');
      expect(ogLocaleTags.length).toBe(1);
      expect(ogLocaleTags[0].getAttribute('content')).toBe('es_ES');
    });
  });

  describe('canonical URL', () => {
    it('should update canonical URL for root path', () => {
      // Create canonical tag
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = 'https://example.com/';
      document.head.appendChild(canonical);

      mockUseLocation.mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'en' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(canonical.getAttribute('href')).toBe('https://safeunfollow.app/');
    });

    it('should update canonical URL for language-specific path', () => {
      // Create canonical tag
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = 'https://example.com/';
      document.head.appendChild(canonical);

      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(canonical.getAttribute('href')).toBe('https://safeunfollow.app/es/wizard');
    });

    it('should not error if canonical tag does not exist', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      expect(() => {
        renderHook(() => useLanguageFromPath());
      }).not.toThrow();
    });
  });

  describe('i18next synchronization', () => {
    it('should call loadLanguage when i18n language differs from store', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      (i18n as any).language = 'en';

      renderHook(() => useLanguageFromPath());

      expect(mockLoadLanguage).toHaveBeenCalledWith('es');
    });

    it('should not call loadLanguage when i18n language matches store', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      (i18n as any).language = 'es';

      renderHook(() => useLanguageFromPath());

      expect(mockLoadLanguage).not.toHaveBeenCalled();
    });
  });

  describe('dependency changes', () => {
    it('should react to pathname changes', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      const { rerender } = renderHook(() => useLanguageFromPath());

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('es');

      // Change pathname
      mockUseLocation.mockReturnValue({
        pathname: '/ru/results',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockSetLanguage.mockClear();
      rerender();

      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });

    it('should react to langFromRoute changes', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      const { rerender } = renderHook(({ lang }) => useLanguageFromPath(lang), {
        initialProps: { lang: 'es' as SupportedLanguage },
      });

      // setLanguage is always called for persistence
      expect(mockSetLanguage).toHaveBeenCalledWith('es');

      // Change langFromRoute
      mockUseAppStore.mockReturnValue({
        language: 'ru' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      mockSetLanguage.mockClear();
      rerender({ lang: 'ru' as SupportedLanguage });

      // setLanguage called with new language
      expect(mockSetLanguage).toHaveBeenCalledWith('ru');
    });

    it('should react to URL pathname changes (URL is source of truth)', () => {
      // Start with Spanish URL
      mockUseLocation.mockReturnValue({
        pathname: '/es/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      mockUseAppStore.mockReturnValue({
        language: 'es' as SupportedLanguage,
        setLanguage: mockSetLanguage,
      });

      (i18n as any).language = 'es';

      const { rerender } = renderHook(() => useLanguageFromPath());
      vi.runAllTimers();

      expect(document.documentElement.lang).toBe('es');

      // Change URL to Russian (simulating navigation)
      mockUseLocation.mockReturnValue({
        pathname: '/ru/wizard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      rerender();
      vi.runAllTimers();

      // HTML lang should update based on URL, not store
      expect(document.documentElement.lang).toBe('ru');
    });
  });
});
