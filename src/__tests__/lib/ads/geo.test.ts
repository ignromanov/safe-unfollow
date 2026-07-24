import { afterEach, describe, expect, it, vi } from 'vitest';

import { ADS_COOKIE_NAME, areAdsAllowed, isSampleRoute, parseAdsCookie } from '@/lib/ads/geo';

function setCookie(value: string): void {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => value,
  });
}

describe('ads/geo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setCookie('');
  });

  describe('parseAdsCookie', () => {
    it('returns true when su_ads=1 is present', () => {
      expect(parseAdsCookie(`${ADS_COOKIE_NAME}=1`)).toBe(true);
      expect(parseAdsCookie(`foo=bar; ${ADS_COOKIE_NAME}=1; baz=qux`)).toBe(true);
    });

    it('returns false when su_ads=0 or absent', () => {
      expect(parseAdsCookie(`${ADS_COOKIE_NAME}=0`)).toBe(false);
      expect(parseAdsCookie('foo=bar')).toBe(false);
      expect(parseAdsCookie('')).toBe(false);
    });

    it('does not match a cookie whose name is a suffix', () => {
      expect(parseAdsCookie(`not_su_ads=1`)).toBe(false);
    });
  });

  describe('areAdsAllowed', () => {
    it('is true when the su_ads=1 cookie is set', () => {
      setCookie(`${ADS_COOKIE_NAME}=1`);
      expect(areAdsAllowed()).toBe(true);
    });

    it('is false when the cookie blocks ads', () => {
      setCookie(`${ADS_COOKIE_NAME}=0`);
      expect(areAdsAllowed()).toBe(false);
    });

    it('is false when no cookie is present (non-Vercel)', () => {
      setCookie('');
      expect(areAdsAllowed()).toBe(false);
    });

    it('honors the dev override when cookie is absent', () => {
      setCookie('');
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_ADSENSE_DEV', '1');
      expect(areAdsAllowed()).toBe(true);
    });

    it('ignores the dev override outside dev mode', () => {
      setCookie('');
      vi.stubEnv('DEV', false);
      vi.stubEnv('VITE_ADSENSE_DEV', '1');
      expect(areAdsAllowed()).toBe(false);
    });
  });

  describe('isSampleRoute', () => {
    it('detects the /sample route and language-prefixed variants', () => {
      window.history.pushState({}, '', '/sample');
      expect(isSampleRoute()).toBe(true);

      window.history.pushState({}, '', '/es/sample');
      expect(isSampleRoute()).toBe(true);
    });

    it('is false on non-sample routes', () => {
      window.history.pushState({}, '', '/results');
      expect(isSampleRoute()).toBe(false);
    });
  });
});
