import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GA4_MEASUREMENT_ID,
  GA4_QUEUE_NAME,
  GA4_SCRIPT_ID,
  GA4_SCRIPT_SRC,
  disableGa4,
  loadGa4,
} from '@/lib/ga4-loader';
import { TRACKING_OPT_OUT_KEY } from '@/lib/stats/constants';

describe('ga4-loader', () => {
  const originalLocation = window.location;
  const originalTop = window.top;

  function setHostname(hostname: string): void {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname },
    });
  }

  beforeEach(() => {
    document.getElementById(GA4_SCRIPT_ID)?.remove();
    delete window.suGaQueue;
    delete window.gtag;
    delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`];
    localStorage.clear();
    setHostname('safeunfollow.app');
    Object.defineProperty(window, 'top', { configurable: true, value: window.self });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
    vi.restoreAllMocks();
  });

  it('injects gtag.js with custom queue (&l=suGaQueue), Consent Mode v2, and Google Signals off', () => {
    loadGa4();

    const script = document.getElementById(GA4_SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect(script?.src).toBe(GA4_SCRIPT_SRC);
    expect(script?.src).toContain(`&l=${GA4_QUEUE_NAME}`);

    expect(Array.isArray(window.suGaQueue)).toBe(true);
    expect(window.suGaQueue?.length).toBe(5);

    // gtag.js requires real Arguments objects in its queue, never plain Arrays.
    for (const entry of window.suGaQueue ?? []) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }

    const commands = (window.suGaQueue ?? []).map(entry => Array.from(entry as ArrayLike<unknown>));
    expect(commands[0]?.[0]).toBe('consent');
    expect(commands[0]?.[1]).toBe('default');
    expect(commands[0]?.[2]).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    expect(commands[4]).toEqual([
      'config',
      GA4_MEASUREMENT_ID,
      {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
  });

  it('is idempotent when called more than once', () => {
    loadGa4();
    loadGa4();

    expect(document.querySelectorAll(`#${GA4_SCRIPT_ID}`)).toHaveLength(1);
    expect(window.suGaQueue?.length).toBe(5);
  });

  it('does not load on localhost or preview workers.dev hosts', () => {
    setHostname('localhost');
    loadGa4();
    expect(document.getElementById(GA4_SCRIPT_ID)).toBeNull();

    setHostname('branch-safe-unfollow.account.workers.dev');
    loadGa4();
    expect(document.getElementById(GA4_SCRIPT_ID)).toBeNull();
  });

  it('does not load when framed inside another window', () => {
    Object.defineProperty(window, 'top', { configurable: true, value: {} as Window });
    loadGa4();

    expect(document.getElementById(GA4_SCRIPT_ID)).toBeNull();
  });

  it('honours umami-opt-out and sets the ga-disable kill switch', () => {
    localStorage.setItem(TRACKING_OPT_OUT_KEY, 'true');
    loadGa4();

    expect(document.getElementById(GA4_SCRIPT_ID)).toBeNull();
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`]).toBe(
      true
    );
  });

  it('disableGa4 sets the kill switch and expires _ga cookies', () => {
    document.cookie = '_ga=GA1.1.12345.67890; path=/';
    disableGa4();

    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`]).toBe(
      true
    );
    expect(document.cookie).not.toContain('GA1.1.12345.67890');
  });
});
