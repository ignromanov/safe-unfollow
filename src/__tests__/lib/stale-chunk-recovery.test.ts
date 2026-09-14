import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A deploy replaces every content-hashed chunk. A tab opened before it still holds the old
 * manifest, so the next dynamic import asks for a filename that is gone, and the import
 * rejects. GH#103.
 *
 * Retrying the same specifier cannot recover it — the browser's module map records the failed
 * fetch against the (url, type) pair and later imports settle from the map without a request,
 * and React's `lazyInitializer` never re-runs a factory whose payload is already rejected. The
 * reasoning is written out at length in src/pages/UploadPage.tsx, which also names what does
 * work: Vite dispatches `vite:preloadError`, and only a reload picks up a new manifest.
 *
 * These tests dispatch that event directly. They cannot make Vite dispatch it: the helper that
 * does is injected by `vite:build-import-analysis`, which is build-only, so under Vitest a
 * dynamic import is never wrapped. That the shipped bundle really does dispatch it is asserted
 * separately against dist/ — a handler listening for an event nothing fires is the failure this
 * pair exists to prevent.
 */
function firePreloadError(): Event {
  const event = new Event('vite:preloadError', { cancelable: true });
  (event as Event & { payload: Error }).payload = new Error(
    'Failed to fetch dynamically imported module: /assets/PaywallModal-CziQ4DYl.js'
  );
  window.dispatchEvent(event);
  return event;
}

describe('stale chunk recovery', () => {
  const realLocation = window.location;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    reload = vi.fn();
    // jsdom's own location.reload is a non-configurable no-op that logs "not implemented",
    // so it is replaced wholesale — the shape used by LanguageSwitcher.test.tsx.
    delete (window as { location?: Location }).location;
    (window as unknown as { location: unknown }).location = { ...realLocation, reload };
  });

  afterEach(() => {
    delete (window as { location?: Location }).location;
    (window as unknown as { location: unknown }).location = realLocation;
    sessionStorage.clear();
  });

  it('reloads the page when a chunk the document references is gone', async () => {
    const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
    installStaleChunkRecovery();

    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload a second time in the same tab', async () => {
    const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
    installStaleChunkRecovery();

    firePreloadError();
    firePreloadError();

    // Two reloads for two dead chunks is a loop, not a recovery: the second reload serves the
    // same document and fails the same way. One attempt, then the error is left to surface.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again after the reload it already performed', async () => {
    const first = await import('@/lib/stale-chunk-recovery');
    first.installStaleChunkRecovery();
    firePreloadError();
    expect(reload).toHaveBeenCalledTimes(1);

    // A reload gives the module a fresh evaluation while sessionStorage survives — which is
    // the whole reason the marker lives there and not in a module variable. Without this the
    // guard above holds only until the page it is guarding goes away.
    vi.resetModules();
    reload.mockClear();

    const second = await import('@/lib/stale-chunk-recovery');
    second.installStaleChunkRecovery();
    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves the error to propagate rather than cancelling it', async () => {
    const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
    installStaleChunkRecovery();

    // Vite rethrows the failure unless a listener calls preventDefault(). Cancelling it here
    // would silence the only report this failure currently produces — ErrorBoundary's
    // componentDidCatch, which is where the events that got GH#103 filed came from.
    expect(firePreloadError().defaultPrevented).toBe(false);
  });

  /**
   * The event fires for speculative preloads too, not only for something the reader clicked:
   * HomePage warms the guide chunk on `requestIdleCallback`, and its `.catch` does not stop the
   * event because Vite dispatches before it rethrows. In a tab that a deploy left stale, that is
   * the best moment a reload could happen — no gesture in flight, filters already persisted to
   * localStorage, account data in IndexedDB. Offline is the case where it is simply wrong: the
   * reload cannot fetch anything the network is withholding, and Workbox answers the navigation
   * from the week-long `pages-cache` with the same document naming the same dead chunk.
   */
  describe('while the browser is offline', () => {
    const setOnLine = (value: boolean): void => {
      Object.defineProperty(navigator, 'onLine', { value, configurable: true });
    };

    afterEach(() => setOnLine(true));

    it('does not reload', async () => {
      setOnLine(false);
      const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
      installStaleChunkRecovery();

      firePreloadError();

      expect(reload).not.toHaveBeenCalled();
    });

    it('leaves the one attempt unspent for when the network is back', async () => {
      setOnLine(false);
      const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
      installStaleChunkRecovery();
      firePreloadError();

      setOnLine(true);
      firePreloadError();

      // Declining to reload is not the same as having reloaded. Spending the guard while offline
      // would leave the tab with no recovery left at the moment recovery becomes possible.
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it('still reloads once when sessionStorage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const { installStaleChunkRecovery } = await import('@/lib/stale-chunk-recovery');
    installStaleChunkRecovery();

    firePreloadError();
    firePreloadError();

    // A browser refusing storage is exactly a browser in a degraded state, which is where this
    // recovery matters most. The cross-reload guard is gone, but the in-page one must hold, or
    // the handler becomes the loop it exists to prevent.
    expect(reload).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
