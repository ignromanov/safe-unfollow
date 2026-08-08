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
      const paywall = bundleFor(language).export?.paywall;

      expect(paywall?.bullet3, `${language} bullet3`).toBeTruthy();
      expect(paywall?.cta, `${language} cta`).toBeTruthy();

      for (const text of [paywall.bullet3, paywall.cta]) {
        const amounts = amountsIn(String(text));
        expect(amounts, `${language} states a price in "${text}"`).not.toHaveLength(0);
        for (const amount of amounts) {
          expect(amount, `${language} "${text}"`).toBe(PRICE);
        }
      }
    }
  });

  // The trigger carried "· $7" for exactly as long as its click opened a
  // paywall instead of downloading anything: a bare download glyph that bills
  // you is a trick, and the price was the honest fix. Now the click hands over
  // a real file, so a price on the button would be the lie in the other
  // direction — charging nothing and appearing to charge $7.
  it('never prices the trigger, because the click delivers a file', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const trigger = String(bundleFor(language).export.trigger);

      expect(trigger, `${language} trigger`).toBeTruthy();
      expect(priceTokenIn(trigger), `${language} trigger must not quote a price`).toBeUndefined();
    }
  });
});

// The cap is a product decision that lives in one constant. A locale that
// spells the number out instead of interpolating it keeps advertising ten rows
// after the constant moves, and no type or test would notice — the string is
// still a valid string.
describe('paywall sample-size copy', () => {
  it('interpolates the row cap rather than hardcoding it', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const paywall = bundleFor(language).export.paywall;

      for (const field of ['headline', 'subtitle'] as const) {
        expect(String(paywall[field]), `${language} ${field}`).toContain('{{rows}}');
      }

      // `export.saved.capped` names the file the free-tier click just wrote
      // and interpolates the same FREE_EXPORT_ROWS constant (commit
      // d45970b). A locale that hardcodes "10" here drifts the same way
      // headline/subtitle would, and this key has no guard yet.
      const savedCapped = String(bundleFor(language).export.saved.capped);
      expect(savedCapped, `${language} export.saved.capped`).toContain('{{rows}}');
    }
  });
});

// The activation limit lives in Dodo's dashboard, so this can no more prove the
// number is right than the price test can. What it prevents is the state this
// copy was written to fix: the limit is real and was stated nowhere, so a buyer
// met it for the first time as a `limit_reached` error on their fourth device —
// a dispute, at roughly five sales each, that the sentence costs nothing to
// avoid. A locale that drops it sells the same licence without the term.
describe('paywall device-limit copy', () => {
  const DEVICES = '3';

  it('states the same activation limit in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bullet3 = String(bundleFor(language).export.paywall.bullet3);

      // Any digit that is not part of the price — the price test owns that one.
      const withoutPrice = bullet3.replace(/\d+(?:[.,]\d{2})?\s*\$|\$\s*\d+(?:[.,]\d{2})?/g, '');
      const numbers = withoutPrice.match(/\d+/g) ?? [];

      expect(numbers, `${language} bullet3 states a device count`).toContain(DEVICES);
    }
  });
});
