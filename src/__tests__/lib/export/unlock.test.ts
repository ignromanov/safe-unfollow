import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeUnlockParam,
  getCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
  resetUnlockCache,
  setExportUnlocked,
  subscribeUnlock,
} from '@/lib/export/unlock';

describe('export/unlock', () => {
  beforeEach(() => {
    localStorage.clear();
    // The unlock flag is memoized in-module (storage reads are synchronous and
    // hot), so clearing localStorage alone would leave a stale snapshot behind.
    resetUnlockCache();
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

  describe('isExportUnlocked / setExportUnlocked', () => {
    it('should be false by default', () => {
      expect(isExportUnlocked()).toBe(false);
    });

    it('should be true after setExportUnlocked', () => {
      setExportUnlocked();
      expect(isExportUnlocked()).toBe(true);
    });
  });

  describe('consumeUnlockParam', () => {
    it('should return false and do nothing when the param is absent', () => {
      window.history.replaceState({}, '', '/results?foo=bar');
      expect(consumeUnlockParam()).toBe(false);
      expect(isExportUnlocked()).toBe(false);
      expect(window.location.search).toBe('?foo=bar');
    });

    it('should set the unlock flag and strip the param when present', () => {
      window.history.replaceState({}, '', '/results?export=unlocked&foo=bar');
      expect(consumeUnlockParam()).toBe(true);
      expect(isExportUnlocked()).toBe(true);
      expect(window.location.search).toBe('?foo=bar');
      expect(window.location.search).not.toContain('export=unlocked');
    });

    it('should be idempotent — a second call returns false once the param is stripped', () => {
      window.history.replaceState({}, '', '/results?export=unlocked');
      expect(consumeUnlockParam()).toBe(true);
      expect(consumeUnlockParam()).toBe(false);
    });
  });

  describe('subscribeUnlock', () => {
    it('should notify subscribers when the unlock flag is set', () => {
      const listener = vi.fn();
      subscribeUnlock(listener);

      setExportUnlocked();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify subscribers when the param is consumed', () => {
      const listener = vi.fn();
      subscribeUnlock(listener);
      window.history.replaceState({}, '', '/results?export=unlocked');

      consumeUnlockParam();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should stop notifying after the returned unsubscribe is called', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeUnlock(listener);

      unsubscribe();
      setExportUnlocked();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should expose the fresh value to subscribers, not a stale cached one', () => {
      let seen: boolean | null = null;
      subscribeUnlock(() => {
        seen = isExportUnlocked();
      });

      setExportUnlocked();

      expect(seen).toBe(true);
    });
  });
});
