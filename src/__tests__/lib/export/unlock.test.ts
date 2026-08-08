import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCheckoutUrl,
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
    it('should be false when VITE_DODO_CHECKOUT_URL is not set', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');
      expect(isExportFeatureEnabled()).toBe(false);
    });

    it('should be true for a recognised live checkout URL', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.dodopayments.com/buy/pdt_x');
      expect(isExportFeatureEnabled()).toBe(true);
    });

    it('should be true for a recognised test checkout URL', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://test.checkout.dodopayments.com/buy/pdt_x');
      expect(isExportFeatureEnabled()).toBe(true);
    });

    it('should be false for a short link, whose mode cannot be known', () => {
      // dodo.pe short links 301 to either mode and their hostname says which
      // one only after a redirect we are not going to follow at runtime. If we
      // cannot tell which mode the buyer will pay in, we must not take the
      // money: the key they get back would be rejected by the other host.
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://dodo.pe/vb124ghir3');
      expect(isExportFeatureEnabled()).toBe(false);
    });

    it('should be false for a checkout URL on some other host', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.example/buy');
      expect(isExportFeatureEnabled()).toBe(false);
    });
  });

  describe('getCheckoutUrl', () => {
    it('should return null when not configured', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');
      expect(getCheckoutUrl()).toBeNull();
    });

    it('should return the configured URL', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.example/buy');
      expect(getCheckoutUrl()).toBe('https://checkout.example/buy');
    });
  });

  describe('buildCheckoutUrl', () => {
    const CHECKOUT = 'https://test.checkout.dodopayments.com/buy/pdt_x';

    it('should attach the current page as the return address', () => {
      // Without redirect_url Dodo keeps the buyer on its own status page and
      // the key never reaches us — observed on a real test purchase.
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', CHECKOUT);
      window.history.replaceState({}, '', '/results');

      const built = new URL(buildCheckoutUrl() ?? '');

      expect(built.searchParams.get('redirect_url')).toBe(`${window.location.origin}/results`);
    });

    it('should return the buyer to the language they bought in', () => {
      // Built from the live path rather than a configured constant, so a
      // Russian buyer lands on /ru/results instead of bouncing through the
      // language redirect with their key in tow.
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', CHECKOUT);
      window.history.replaceState({}, '', '/ru/results');

      const built = new URL(buildCheckoutUrl() ?? '');

      expect(built.searchParams.get('redirect_url')).toBe(`${window.location.origin}/ru/results`);
    });

    it('should replace a redirect_url already baked into the configured URL', () => {
      // The dashboard hands out links with redirect_url pre-filled to the
      // production host. Kept as-is, no preview deploy or localhost could ever
      // complete a purchase loop.
      vi.stubEnv(
        'VITE_DODO_CHECKOUT_URL',
        `${CHECKOUT}?quantity=1&redirect_url=https://safeunfollow.app/results`
      );
      window.history.replaceState({}, '', '/results');

      const built = new URL(buildCheckoutUrl() ?? '');

      expect(built.searchParams.getAll('redirect_url')).toEqual([
        `${window.location.origin}/results`,
      ]);
      expect(built.searchParams.get('quantity')).toBe('1');
    });

    it('should return null when checkout is not configured', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');

      expect(buildCheckoutUrl()).toBeNull();
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
      window.history.replaceState({}, '', `/results?license_key=${KEY}`);

      expect(consumeLicenseParam()).toBe(KEY);
      expect(window.location.search).toBe('');
    });

    it('should preserve unrelated params while stripping the key', () => {
      window.history.replaceState({}, '', `/results?utm_source=email&license_key=${KEY}`);

      expect(consumeLicenseParam()).toBe(KEY);
      expect(window.location.search).toBe('?utm_source=email');
    });

    it('should strip the buyer email and payment id the redirect carries', () => {
      // Dodo appends payment_id, status and email alongside the key. Only the
      // key is ours to use; the rest is the buyer's identity, and leaving it in
      // the URL would hand it to history, the referrer, and the Umami pageview
      // on a site whose entire promise is that nothing personal leaves the
      // device.
      window.history.replaceState(
        {},
        '',
        `/results?payment_id=pay_abc&status=succeeded&license_key=${KEY}&email=buyer%40example.com`
      );

      expect(consumeLicenseParam()).toBe(KEY);
      expect(window.location.search).toBe('');
    });

    it('should strip the checkout params even when no key came back', () => {
      // A product misconfiguration delivers a payment without a license. The
      // email must not survive that path either.
      window.history.replaceState({}, '', '/results?payment_id=pay_abc&email=buyer%40example.com');

      expect(consumeLicenseParam()).toBeNull();
      expect(window.location.search).toBe('');
    });

    it('should handle a real Dodo return URL, captured from a test purchase', () => {
      // The only assertion in this file built from an observed transaction
      // rather than from reading the docs. Recorded 2026-08-08, test mode,
      // payment pay_0NkvPGIP0zCPcXtVGqc76 — param names, their order, the
      // percent-encoded email and the language-prefixed path are all exactly
      // as Dodo delivered them. The key is a UUID v4, which is what Dodo
      // auto-generates; the docs' LK-001 / PRO-AAAA examples are imported
      // keys, which is why isLicenseKeyFormat stays permissive.
      window.history.replaceState(
        {},
        '',
        '/ru/results?payment_id=pay_0NkvPGIP0zCPcXtVGqc76&status=succeeded' +
          '&license_key=7209f960-d2f9-4d23-ab81-2f251ea8e70b&email=test%40test.com'
      );

      expect(consumeLicenseParam()).toBe('7209f960-d2f9-4d23-ab81-2f251ea8e70b');
      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/ru/results');
    });

    it('should take the first key when the redirect carries several', () => {
      // Dodo comma-joins keys when a purchase grants more than one. One product
      // grants one, but a second entitlement added later would silently pass a
      // two-key string to activate and fail with a 404 nobody could explain.
      window.history.replaceState({}, '', `/results?license_key=${KEY},SECOND-KEY-0002`);

      expect(consumeLicenseParam()).toBe(KEY);
    });

    it('should not store anything by itself', () => {
      window.history.replaceState({}, '', `/results?license_key=${KEY}`);

      consumeLicenseParam();

      expect(isExportUnlocked()).toBe(false);
    });

    it('should be idempotent: a second call finds nothing left to consume', () => {
      // Guards the invariant Critical 2's stored-license check depends on —
      // the param must not still be readable after Layout's first render
      // consumes it, or a re-render could hand the key to activation again.
      window.history.replaceState({}, '', `/results?license_key=${KEY}`);

      expect(consumeLicenseParam()).toBe(KEY);
      expect(consumeLicenseParam()).toBeNull();
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
