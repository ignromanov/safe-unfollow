import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDisplayPrice, resolveCheckoutCountry } from '@/lib/export/country-price';

/**
 * Replaces what the browser reports as its timezone.
 *
 * A spy rather than `process.env.TZ`, which jsdom reads once at startup and
 * which would make these cases order-dependent on each other.
 */
function stubTimeZone(timeZone: string): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as unknown as Intl.DateTimeFormat);
}

describe('export/country-price', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveCheckoutCountry', () => {
    // Indonesia spans four zones and the reader in Jayapura pays what the
    // reader in Jakarta pays. Listing only the capital's zone would price three
    // of the four in dollars while the checkout charged them in rupiah — the
    // one failure mode this whole design exists to make unrepresentable, and it
    // would show up in exactly the market that is 24% of our page views.
    it.each([
      ['Asia/Jakarta', 'ID'],
      ['Asia/Pontianak', 'ID'],
      ['Asia/Makassar', 'ID'],
      ['Asia/Jayapura', 'ID'],
      ['Asia/Kolkata', 'IN'],
      // The deprecated alias, still reported by some engines. A browser that
      // has not migrated is not a browser in a different country.
      ['Asia/Calcutta', 'IN'],
      ['Asia/Manila', 'PH'],
    ])('should resolve %s to %s', (timeZone, country) => {
      stubTimeZone(timeZone);

      expect(resolveCheckoutCountry()).toBe(country);
    });

    // Null is the answer for everyone outside the three priced markets, which
    // is most buyers and both settled sales so far. It is a complete answer,
    // not a failure: it is what makes the `country` parameter absent, which is
    // what lets the processor apply its own detection.
    it('should resolve an unmapped timezone to no country', () => {
      stubTimeZone('Europe/Berlin');

      expect(resolveCheckoutCountry()).toBeNull();
    });

    // A resolver that can throw takes the paywall down with it, and the paywall
    // is the highest-value screen in the product. There is nothing to gain by
    // propagating: the fallback is the price nine countries out of ten see.
    it('should resolve to no country when Intl throws', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Intl unavailable');
      });

      expect(resolveCheckoutCountry()).toBeNull();
    });
  });

  describe('getDisplayPrice', () => {
    // The amounts are read back off the live checkout, in the currency each is
    // set in. A conversion computed here would be a third exchange rate
    // shipping beside two others and going stale on its own schedule.
    it.each([
      ['Asia/Jakarta', 'Rp50.000'],
      ['Asia/Kolkata', '₹200'],
      ['Asia/Manila', '₱150'],
    ])('should price %s at %s', (timeZone, price) => {
      stubTimeZone(timeZone);

      expect(getDisplayPrice()).toBe(price);
    });

    it('should fall back to the base dollar price outside the priced markets', () => {
      stubTimeZone('America/New_York');

      expect(getDisplayPrice()).toBe('$7');
    });

    it('should fall back to the base dollar price when Intl throws', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Intl unavailable');
      });

      expect(getDisplayPrice()).toBe('$7');
    });
  });
});
