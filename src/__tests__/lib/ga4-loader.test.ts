import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GA4_MEASUREMENT_ID,
  GA4_SCRIPT_ID,
  GA4_SCRIPT_SRC,
  disableGa4,
  loadGa4,
  sanitizeGaPageLocation,
} from '@/lib/ga4-loader';
import { TRACKING_OPT_OUT_KEY } from '@/lib/stats/constants';

describe('ga4-loader', () => {
  const originalLocation = window.location;
  const originalTop = window.top;

  function setLocation(hostname: string, href = `https://${hostname}/results`): void {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname, href },
    });
  }

  beforeEach(() => {
    document.getElementById(GA4_SCRIPT_ID)?.remove();
    delete window.dataLayer;
    delete window.gtag;
    delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`];
    localStorage.clear();
    setLocation('safeunfollow.app');
    Object.defineProperty(window, 'top', { configurable: true, value: window.self });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
    vi.restoreAllMocks();
  });

  it('injects gtag.js with standard window.dataLayer, Consent Mode v2, and sanitized page_location', () => {
    setLocation(
      'safeunfollow.app',
      'https://safeunfollow.app/results?utm_source=tiktok&license_key=lic_secret&email=buyer%40example.com&payment_id=pay_123&status=succeeded'
    );
    loadGa4();

    const script = document.getElementById(GA4_SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect(script?.src).toBe(GA4_SCRIPT_SRC);
    expect(script?.src).not.toContain('&l=');

    expect(Array.isArray(window.dataLayer)).toBe(true);
    expect(window.dataLayer?.length).toBe(5);

    // gtag.js requires real Arguments objects in dataLayer, never plain Arrays.
    for (const entry of window.dataLayer ?? []) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }

    const commands = (window.dataLayer ?? []).map(entry => Array.from(entry as ArrayLike<unknown>));
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
        page_location: 'https://safeunfollow.app/results?utm_source=tiktok',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
  });

  it('sanitizeGaPageLocation strips checkout return PII while keeping UTM params', () => {
    expect(
      sanitizeGaPageLocation(
        'https://safeunfollow.app/results?utm_medium=short&license_key=abc&email=a%40b.co&payment_id=p1&subscription_id=s1&status=active'
      )
    ).toBe('https://safeunfollow.app/results?utm_medium=short');
  });

  it('is idempotent when called more than once', () => {
    loadGa4();
    loadGa4();

    expect(document.querySelectorAll(`#${GA4_SCRIPT_ID}`)).toHaveLength(1);
    expect(window.dataLayer?.length).toBe(5);
  });

  it('does not load on localhost or preview workers.dev hosts', () => {
    setLocation('localhost', 'http://localhost:5173/');
    loadGa4();
    expect(document.getElementById(GA4_SCRIPT_ID)).toBeNull();

    setLocation('branch-safe-unfollow.account.workers.dev');
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
