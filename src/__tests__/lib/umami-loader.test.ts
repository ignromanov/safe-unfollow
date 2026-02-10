import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('umami-loader', () => {
  let localStorageMock: Record<string, string> = {};
  let mockScript: HTMLScriptElement;
  let appendChildSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset module cache to reload with fresh state
    vi.resetModules();

    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      key: () => null,
      length: 0,
    };

    // Mock document.createElement
    mockScript = {
      defer: false,
      src: '',
      dataset: {} as DOMStringMap,
    } as HTMLScriptElement;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'script') {
        return mockScript;
      }
      return originalCreateElement(tagName);
    });

    // Mock document.head.appendChild
    appendChildSpy = vi.fn();
    Object.defineProperty(document.head, 'appendChild', {
      value: appendChildSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadUmami', () => {
    it('should load Umami script in browser with correct attributes', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(mockScript.defer).toBe(true);
      expect(mockScript.src).toBe('https://umami-coral-xi.vercel.app/script.js');
      expect(mockScript.dataset.websiteId).toBe('70c9e250-c415-4c56-92b0-2792dc6cccba');
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should not load Umami script when user opted out', async () => {
      localStorageMock['umami-opt-out'] = 'true';

      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('should load Umami script when opt-out is not set', async () => {
      // localStorage without opt-out key

      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should load Umami script when opt-out is false', async () => {
      localStorageMock['umami-opt-out'] = 'false';

      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should handle localStorage unavailable gracefully', async () => {
      // @ts-expect-error - Testing edge case
      global.localStorage = undefined;

      const { loadUmami } = await import('@/lib/umami-loader');

      expect(() => loadUmami()).not.toThrow();
      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should not load in SSR environment (document undefined)', async () => {
      const originalDocument = global.document;
      // @ts-expect-error - Testing SSR
      global.document = undefined;

      const { loadUmami } = await import('@/lib/umami-loader');

      expect(() => loadUmami()).not.toThrow();

      global.document = originalDocument;
    });

    it('should set script defer to true', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(mockScript.defer).toBe(true);
    });

    it('should use correct self-hosted Umami URL', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(mockScript.src).toBe('https://umami-coral-xi.vercel.app/script.js');
    });

    it('should use correct website ID', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(mockScript.dataset.websiteId).toBe('70c9e250-c415-4c56-92b0-2792dc6cccba');
    });

    it('should append script to document head', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should handle multiple calls by creating multiple scripts', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();
      loadUmami();

      expect(document.createElement).toHaveBeenCalledTimes(2);
      expect(appendChildSpy).toHaveBeenCalledTimes(2);
    });

    it('should not load when opt-out value is exactly "true" string', async () => {
      localStorageMock['umami-opt-out'] = 'TRUE'; // Different case

      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      // Should load because it's not exactly 'true'
      expect(document.createElement).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });
});
