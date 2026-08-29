import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const WEBSITE_ID = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';

describe('umami-loader', () => {
  let localStorageMock: Record<string, string> = {};
  let mockScript: HTMLScriptElement;
  let appendChildSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset module cache to reload with fresh state
    vi.resetModules();

    // The loader has no built-in website id: unset means "do not collect".
    // Every test that expects collection has to say which record it collects to.
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', WEBSITE_ID);

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
    vi.unstubAllEnvs();
  });

  describe('loadUmami', () => {
    it('should load Umami script in browser with correct attributes', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(mockScript.defer).toBe(true);
      expect(mockScript.src).toBe('/v/script.js');
      expect(mockScript.dataset.websiteId).toBe(WEBSITE_ID);
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('should not load Umami script when no website id is configured', async () => {
      // Preview and local builds carry no VITE_UMAMI_WEBSITE_ID. Without this
      // gate the loader fell back to the production id and every preview
      // session landed in the dataset the live numbers are read from.
      vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '');

      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(document.createElement).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
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

      expect(mockScript.src).toBe('/v/script.js');
    });

    it('should use correct website ID', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(mockScript.dataset.websiteId).toBe(WEBSITE_ID);
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

  describe('isLandingPath', () => {
    it.each([
      ['/', true],
      ['', true],
      ['/id', true],
      ['/id/', true],
      ['/ru', true],
      ['/ar', true],
    ])('treats %s as the landing page: %s', async (pathname, expected) => {
      const { isLandingPath } = await import('@/lib/umami-loader');

      expect(isLandingPath(pathname)).toBe(expected);
    });

    it.each([
      ['/results'],
      ['/id/results'],
      ['/upload'],
      ['/sample'],
      ['/ru/sample'],
      ['/privacy'],
    ])('rejects %s', async pathname => {
      const { isLandingPath } = await import('@/lib/umami-loader');

      expect(isLandingPath(pathname)).toBe(false);
    });

    it('rejects /en, which routes.tsx does not generate', async () => {
      const { isLandingPath } = await import('@/lib/umami-loader');

      expect(isLandingPath('/en')).toBe(false);
    });
  });

  describe('loadHeatmapRecorder', () => {
    const CONFIG_URL = `/v/api/websites/${WEBSITE_ID}/recorder`;

    let fetchMock: ReturnType<typeof vi.fn>;

    /** Answer the recorder config endpoint with `body`, or a non-ok response. */
    function mockConfig(body: unknown, ok = true): void {
      fetchMock.mockResolvedValue({ ok, json: async () => body });
    }

    /** Drive the module past its first-interaction gate and let injectRecorder settle. */
    async function fireFirstInteraction(): Promise<void> {
      window.dispatchEvent(new Event('pointerdown'));
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      await Promise.resolve();
      await Promise.resolve();
    }

    beforeEach(() => {
      window.history.pushState({}, '', '/');
      fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;
      mockConfig({ enabled: true, replayEnabled: false, heatmapEnabled: true });
    });

    it('injects the recorder on the landing page after the first interaction', async () => {
      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();

      // Nothing is requested or injected until the visitor interacts.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();

      await fireFirstInteraction();

      expect(fetchMock).toHaveBeenCalledWith(CONFIG_URL, { credentials: 'omit' });
      expect(mockScript.src).toBe('/v/recorder.js');
      expect(mockScript.dataset.websiteId).toBe(WEBSITE_ID);
      expect(mockScript.dataset.hostUrl).toBe('/v');
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it('attaches no listener when no website id is configured', async () => {
      vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '');

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('accepts a prefixed locale landing page', async () => {
      window.history.pushState({}, '', '/id');

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    });

    it.each(['/results', '/id/results', '/upload', '/sample'])(
      'never attaches a listener on %s',
      async pathname => {
        window.history.pushState({}, '', pathname);

        const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

        loadHeatmapRecorder();
        window.dispatchEvent(new Event('pointerdown'));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(appendChildSpy).not.toHaveBeenCalled();
      }
    );

    it('does not inject when the visitor left the landing page before the config resolved', async () => {
      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();

      // The first interaction IS the click that navigates away.
      window.history.pushState({}, '', '/results');
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('refuses to load when the dashboard has replay switched on', async () => {
      mockConfig({ enabled: true, replayEnabled: true, heatmapEnabled: true });

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['replayEnabled missing', { enabled: true, heatmapEnabled: true }],
      ['heatmap off', { enabled: true, replayEnabled: false, heatmapEnabled: false }],
      ['recorder off', { enabled: false }],
      ['empty body', {}],
    ])('fails closed when the config says %s', async (_label, body) => {
      mockConfig(body);

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('fails closed when the config endpoint errors', async () => {
      mockConfig({}, false);

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('fails closed when the config fetch rejects', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('respects the same opt-out as the tracker', async () => {
      localStorageMock['umami-opt-out'] = 'true';

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      window.dispatchEvent(new Event('pointerdown'));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('injects at most once across several interactions', async () => {
      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      await fireFirstInteraction();

      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('keydown'));
      window.dispatchEvent(new Event('scroll'));
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Umami's heatmap report renders the live landing page in an iframe
   * (`Heatmap.tsx` -> `<iframe src={snapshot.url}>`), and neither our loader nor
   * Umami's own tracker carries a top-window check. Without one, every read of
   * the heatmap files a pageview against the very page being measured — from
   * the operator's browser, on the one route that collects heatmap data.
   */
  describe('inside a frame', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'top', { value: {}, configurable: true });
    });

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>).top;
    });

    it('does not load the tracker, so a heatmap view is not counted as a visit', async () => {
      const { loadUmami } = await import('@/lib/umami-loader');

      loadUmami();

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('does not arm the heatmap recorder either', async () => {
      window.history.pushState({}, '', '/');
      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const { loadHeatmapRecorder } = await import('@/lib/umami-loader');

      loadHeatmapRecorder();
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(appendChildSpy).not.toHaveBeenCalled();
    });
  });
});
