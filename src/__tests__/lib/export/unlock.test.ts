import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeUnlockParam,
  getCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
  setExportUnlocked,
} from '@/lib/export/unlock';

describe('export/unlock', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/results');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isExportFeatureEnabled', () => {
    it('is false when VITE_LEMONSQUEEZY_URL is not set', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');
      expect(isExportFeatureEnabled()).toBe(false);
    });

    it('is true when VITE_LEMONSQUEEZY_URL is set', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', 'https://checkout.example/buy');
      expect(isExportFeatureEnabled()).toBe(true);
    });
  });

  describe('getCheckoutUrl', () => {
    it('returns null when not configured', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');
      expect(getCheckoutUrl()).toBeNull();
    });

    it('returns the configured URL', () => {
      vi.stubEnv('VITE_LEMONSQUEEZY_URL', 'https://checkout.example/buy');
      expect(getCheckoutUrl()).toBe('https://checkout.example/buy');
    });
  });

  describe('isExportUnlocked / setExportUnlocked', () => {
    it('is false by default', () => {
      expect(isExportUnlocked()).toBe(false);
    });

    it('is true after setExportUnlocked', () => {
      setExportUnlocked();
      expect(isExportUnlocked()).toBe(true);
    });
  });

  describe('consumeUnlockParam', () => {
    it('returns false and does nothing when param is absent', () => {
      window.history.replaceState({}, '', '/results?foo=bar');
      expect(consumeUnlockParam()).toBe(false);
      expect(isExportUnlocked()).toBe(false);
      expect(window.location.search).toBe('?foo=bar');
    });

    it('sets unlock flag and strips the param when present', () => {
      window.history.replaceState({}, '', '/results?export=unlocked&foo=bar');
      expect(consumeUnlockParam()).toBe(true);
      expect(isExportUnlocked()).toBe(true);
      expect(window.location.search).toBe('?foo=bar');
      expect(window.location.search).not.toContain('export=unlocked');
    });

    it('is idempotent — second call returns false once param is stripped', () => {
      window.history.replaceState({}, '', '/results?export=unlocked');
      expect(consumeUnlockParam()).toBe(true);
      expect(consumeUnlockParam()).toBe(false);
    });
  });
});
