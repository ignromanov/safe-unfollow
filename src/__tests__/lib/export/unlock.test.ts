import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLicense,
  consumeLicenseParam,
  getCheckoutUrl,
  getStoredLicense,
  isExportFeatureEnabled,
  isExportUnlocked,
  markValidatedThisSession,
  resetUnlockCache,
  resetValidationFlag,
  shouldValidateThisSession,
  storeLicense,
  subscribeUnlock,
} from '@/lib/export/unlock';

describe('export/unlock', () => {
  const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
  const INSTANCE = 'f90ec370-fd83-46a5-8bbd-44a241e78665';

  beforeEach(() => {
    localStorage.clear();
    // The unlock flag is memoized in-module (storage reads are synchronous and
    // hot), so clearing localStorage alone would leave a stale snapshot behind.
    resetUnlockCache();
    resetValidationFlag();
    window.history.replaceState({}, '', '/results');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isExportFeatureEnabled', () => {
    it('should be false when VITE_LEMONSQUEEZY_URL is not set', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');
      expect(isExportFeatureEnabled()).toBe(false);
    });

    it('should be true when VITE_LEMONSQUEEZY_URL is set', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', 'https://checkout.example/buy');
      expect(isExportFeatureEnabled()).toBe(true);
    });
  });

  describe('getCheckoutUrl', () => {
    it('should return null when not configured', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');
      expect(getCheckoutUrl()).toBeNull();
    });

    it('should return the configured URL', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', 'https://checkout.example/buy');
      expect(getCheckoutUrl()).toBe('https://checkout.example/buy');
    });
  });

  describe('storeLicense / getStoredLicense / isExportUnlocked', () => {
    it('should be locked by default', () => {
      expect(isExportUnlocked()).toBe(false);
      expect(getStoredLicense()).toBeNull();
    });

    it('should unlock after storing a license', () => {
      storeLicense(KEY, INSTANCE);

      expect(isExportUnlocked()).toBe(true);
      expect(getStoredLicense()).toEqual({ v: 1, key: KEY, instanceId: INSTANCE });
    });

    it('should lock again after clearLicense', () => {
      storeLicense(KEY, INSTANCE);
      clearLicense();

      expect(isExportUnlocked()).toBe(false);
      expect(getStoredLicense()).toBeNull();
    });

    it('should treat the legacy "1" flag as locked', () => {
      localStorage.setItem('su-pro-export', '1');
      resetUnlockCache();

      expect(isExportUnlocked()).toBe(false);
    });

    it('should treat a malformed entry as locked', () => {
      localStorage.setItem('su-pro-export', '{"v":1,"key":"only-a-key"}');
      resetUnlockCache();

      expect(isExportUnlocked()).toBe(false);
    });

    it('should notify subscribers when a license is stored', () => {
      const listener = vi.fn();
      subscribeUnlock(listener);

      storeLicense(KEY, INSTANCE);

      expect(listener).toHaveBeenCalled();
    });

    it('should notify subscribers when the license is cleared', () => {
      storeLicense(KEY, INSTANCE);
      const listener = vi.fn();
      subscribeUnlock(listener);

      clearLicense();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('consumeLicenseParam', () => {
    it('should return null when the param is absent', () => {
      window.history.replaceState({}, '', '/results');

      expect(consumeLicenseParam()).toBeNull();
    });

    it('should return the key and strip the param', () => {
      window.history.replaceState({}, '', `/results?license=${KEY}`);

      expect(consumeLicenseParam()).toBe(KEY);
      expect(window.location.search).toBe('');
    });

    it('should preserve unrelated params while stripping the key', () => {
      window.history.replaceState({}, '', `/results?utm_source=email&license=${KEY}`);

      expect(consumeLicenseParam()).toBe(KEY);
      expect(window.location.search).toBe('?utm_source=email');
    });

    it('should not store anything by itself', () => {
      window.history.replaceState({}, '', `/results?license=${KEY}`);

      consumeLicenseParam();

      expect(isExportUnlocked()).toBe(false);
    });
  });

  describe('shouldValidateThisSession', () => {
    it('should be true before the first validation', () => {
      expect(shouldValidateThisSession()).toBe(true);
    });

    it('should be false once marked', () => {
      markValidatedThisSession();

      expect(shouldValidateThisSession()).toBe(false);
    });
  });

  describe('subscribeUnlock', () => {
    it('should notify subscribers when the license is stored', () => {
      const listener = vi.fn();
      subscribeUnlock(listener);

      storeLicense(KEY, INSTANCE);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should stop notifying after the returned unsubscribe is called', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeUnlock(listener);

      unsubscribe();
      storeLicense(KEY, INSTANCE);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should expose the fresh value to subscribers, not a stale cached one', () => {
      let seen: boolean | null = null;
      subscribeUnlock(() => {
        seen = isExportUnlocked();
      });

      storeLicense(KEY, INSTANCE);

      expect(seen).toBe(true);
    });
  });
});
