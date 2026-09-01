import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getDisplayPrice,
  getRivalMonthlyRange,
  resolveCheckoutCountry,
} from '@/lib/export/country-price';

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

/** The currency token a display string opens or closes with — `Rp`, `₹`, `₱` or `$`. */
function currencyTokenIn(text: string): string | undefined {
  return /^(Rp|₹|₱|\$)|(Rp|₹|₱|\$)$/.exec(text)?.[0];
}

/** Both ends of a numeric range, whichever dash the string sets it with. */
function rangeIn(text: string): string[] {
  const match = /(\d+(?:[.,]\d+)?)\s*[-–—−~〜～]\s*(\d+(?:[.,]\d+)?)/.exec(text);
  return match ? [match[1], match[2]] : [];
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

  describe('getRivalMonthlyRange', () => {
    // Measured rival prices, read from the handoffs cited in the source
    // comment — not a conversion of our own $5–10, which is the mistake
    // id/faq.json made and this table exists to not repeat.
    it.each([
      ['Asia/Jakarta', 'Rp69.000–169.000'],
      ['Asia/Kolkata', '₹399–999'],
      ['Asia/Manila', '₱249–499'],
    ])('should anchor %s at %s', (timeZone, rivals) => {
      stubTimeZone(timeZone);

      expect(getRivalMonthlyRange()).toBe(rivals);
    });

    it('should fall back to the default dollar range outside the priced markets', () => {
      stubTimeZone('America/New_York');

      expect(getRivalMonthlyRange()).toBe('$5–10');
    });

    it('should fall back to the default dollar range when Intl throws', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Intl unavailable');
      });

      expect(getRivalMonthlyRange()).toBe('$5–10');
    });
  });

  // The whole defect this anchor closes, expressed as an assertion: a reader
  // must never be shown two currencies in one sentence. For every country and
  // for the default pair, the anchor's currency token must match the price's.
  describe('price and rival anchor agree on currency', () => {
    it.each([
      ['Asia/Jakarta', 'ID'],
      ['Asia/Kolkata', 'IN'],
      ['Asia/Manila', 'PH'],
      ['America/New_York', 'default'],
    ])('should use the same currency token for %s (%s)', timeZone => {
      stubTimeZone(timeZone);

      const token = currencyTokenIn(getDisplayPrice());

      // Asserted before the comparison, because two unrecognised symbols are
      // equal to each other: without this line a currency the token regex does
      // not know — a `R$` added for Brazil, say — turns the assertion below
      // into `undefined === undefined` and the guard goes green having checked
      // nothing.
      expect(token, `${timeZone} price carries a currency token`).toBeDefined();
      expect(currencyTokenIn(getRivalMonthlyRange())).toBe(token);
    });

    it('should give every anchor a range whose low end is below its high end', () => {
      for (const timeZone of ['Asia/Jakarta', 'Asia/Kolkata', 'Asia/Manila', 'America/New_York']) {
        stubTimeZone(timeZone);

        const [low, high] = rangeIn(getRivalMonthlyRange()).map(n => Number(n.replace('.', '')));
        expect(low, `${timeZone} range low`).toBeLessThan(high);
      }
    });
  });
});
