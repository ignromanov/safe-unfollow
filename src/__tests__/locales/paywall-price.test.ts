import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/results.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, any> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no results.json for ${language}`);
  return entry[1] as Record<string, any>;
}

/** Every amount in a paywall string, ignoring the currency symbol's position. */
function amountsIn(text: string): string[] {
  return [...text.matchAll(/(\d+(?:[.,]\d{2})?)\s*\$|\$\s*(\d+(?:[.,]\d{2})?)/g)].map(
    match => match[1] ?? match[2] ?? ''
  );
}

// The price lives in Dodo's dashboard, so no test can prove the copy matches
// what the buyer is actually charged. What a test can prove is that the eleven
// locales agree with each other: the price moved $3 → $7 by a regex sweep over
// eleven files whose currency formats differ (`$7`, `7 $`, `7$`), and a locale
// missed by such a sweep advertises a price this product does not sell at.
describe('paywall price copy', () => {
  const PRICE = '7';

  it('quotes the same amount in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const paywall = bundleFor(language).export?.paywall;

      expect(paywall?.bullet3, `${language} bullet3`).toBeTruthy();
      expect(paywall?.cta, `${language} cta`).toBeTruthy();

      for (const field of ['bullet3', 'cta'] as const) {
        const amounts = amountsIn(String(paywall[field]));
        expect(amounts, `${language} ${field} states a price`).not.toHaveLength(0);
        for (const amount of amounts) {
          expect(amount, `${language} ${field}`).toBe(PRICE);
        }
      }
    }
  });
});
