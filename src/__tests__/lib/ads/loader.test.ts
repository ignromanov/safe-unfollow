import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAdsenseScriptLoaded, loadAdsenseScript, pushAdSlot } from '@/lib/ads/loader';

const SCRIPT_ID = 'adsbygoogle-js';
const CLIENT = 'ca-pub-5976295812261948';

describe('ads/loader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.getElementById(SCRIPT_ID)?.remove();
    delete (window as { adsbygoogle?: unknown[] }).adsbygoogle;
    // jsdom lacks requestIdleCallback → exercise the setTimeout fallback.
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.getElementById(SCRIPT_ID)?.remove();
  });

  it('injects the AdSense script with the expected attributes', () => {
    loadAdsenseScript(CLIENT);
    vi.runAllTimers();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect(script?.crossOrigin).toBe('anonymous');
    expect(script?.src).toBe(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        CLIENT
      )}`
    );
  });

  it('injects the script only once across multiple calls', () => {
    loadAdsenseScript(CLIENT);
    loadAdsenseScript(CLIENT);
    vi.runAllTimers();
    loadAdsenseScript(CLIENT);
    vi.runAllTimers();

    expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
  });

  it('prefers requestIdleCallback when available', () => {
    const idle = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    (window as { requestIdleCallback?: typeof idle }).requestIdleCallback = idle;

    loadAdsenseScript(CLIENT);

    expect(idle).toHaveBeenCalledTimes(1);
    expect(isAdsenseScriptLoaded()).toBe(true);
  });

  it('pushAdSlot initializes the adsbygoogle queue and does not throw', () => {
    expect(() => pushAdSlot()).not.toThrow();
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect(window.adsbygoogle).toHaveLength(1);
  });
});
