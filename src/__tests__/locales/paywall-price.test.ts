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

/** The price exactly as this locale spells it, symbol placement included. */
function priceTokenIn(text: string): string | undefined {
  return /\d+(?:[.,]\d{2})?\s*\$|\$\s*\d+(?:[.,]\d{2})?/.exec(text)?.[0];
}

// The price lives in Dodo's dashboard, so no test can prove the copy matches
// what the buyer is actually charged. What a test can prove is that the ten
// locales agree with each other: the price moved $3 → $7 by a regex sweep over
// files whose currency formats differ (`$7`, `7 $`, `7$`), and a locale
// missed by such a sweep advertises a price this product does not sell at.
describe('paywall price copy', () => {
  const PRICE = '7';

  it('quotes the same amount in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language).export;
      const paywall = bundle?.paywall;

      expect(paywall?.bullet3, `${language} bullet3`).toBeTruthy();
      expect(paywall?.cta, `${language} cta`).toBeTruthy();
      expect(bundle?.trigger, `${language} trigger`).toBeTruthy();

      for (const text of [paywall.bullet3, paywall.cta, bundle.trigger]) {
        const amounts = amountsIn(String(text));
        expect(amounts, `${language} states a price in "${text}"`).not.toHaveLength(0);
        for (const amount of amounts) {
          expect(amount, `${language} "${text}"`).toBe(PRICE);
        }
      }
    }
  });

  // The trigger and the paywall are one click apart, so a locale that writes
  // `$7` on the button and `7 $` in the modal shows one price two ways inside a
  // single flow. Amount-only agreement (above) cannot catch that: both spell 7.
  it('spells the price the same way on the trigger as in the paywall', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language).export;

      const paywallToken = priceTokenIn(String(bundle.paywall.bullet3));
      const triggerToken = priceTokenIn(String(bundle.trigger));

      expect(paywallToken, `${language} bullet3 price token`).toBeTruthy();
      expect(triggerToken, `${language} trigger price token`).toBe(paywallToken);
    }
  });
});
