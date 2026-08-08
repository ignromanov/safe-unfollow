import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/languages';

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

/** Both ends of a "$5–10" range, whichever dash the locale sets it with. */
function rangeIn(text: string): string[] {
  const match = /(\d+)\s*[-–—−~〜～]\s*(\d+)/.exec(text);
  return match ? [match[1], match[2]] : [];
}

// The price lives in Dodo's dashboard, so no test can prove the copy matches
// what the buyer is actually charged. What a test can prove is that the ten
// locales agree with each other: the price moved $3 → $7 by a regex sweep over
// files whose currency formats differ (`$7`, `7 $`, `7$`), and a locale
// missed by such a sweep advertises a price this product does not sell at.
describe('paywall price copy', () => {
  const PRICE = '7';

  // `subtitle` is deliberately absent from this sweep. It carries the contrast
  // anchor, whose $5–10 is price-shaped but is not our price; folding it in
  // would make one mutation trip two assertions and neither would then say
  // which number moved. The anchor has its own guard below.
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

      // `subtitle` used to restate the cap and is checked no longer: it now
      // carries the contrast anchor, and the cap is stated by the receipt strip
      // directly above it. `headline` must name the reader's own total, not
      // "the rest" — a vague headline over a precise receipt reads as evasion.
      expect(String(paywall.headline), `${language} headline`).toContain('{{rows}}');
      expect(String(paywall.headline), `${language} headline`).toContain('{{total}}');

      // `export.saved.capped` names the file the free-tier click just wrote
      // and interpolates the same FREE_EXPORT_ROWS constant (commit
      // d45970b). A locale that hardcodes "10" here drifts the same way
      // headline/subtitle would, and this key has no guard yet.
      const savedCapped = String(bundleFor(language).export.saved.capped);
      expect(savedCapped, `${language} export.saved.capped`).toContain('{{rows}}');
    }
  });
});

// The subtitle is the only place the buyer is given something to compare $7
// against. The comparison is to what the category charges — App Store pricing
// measured 2026-08-08: modal Pro tier $4.99/month, advanced tiers $9.99/month.
// It is a comparison of pricing *models*, because none of those trackers sells
// a data export at all; a locale that turned it into a feature comparison would
// be making a false claim, and that a test cannot catch. What it can catch is
// the numeric drift: a translator who writes $5–15, or drops "a month" and
// leaves "$5–10" reading as a one-off cheaper than ours — an anchor pointing
// the wrong way is worse than no anchor.
describe('paywall contrast anchor', () => {
  /**
   * Proof, per language, that the range is a *monthly* rate.
   *
   * A numeral-only check passes "$5–10 once", which inverts the comparison, so
   * each entry pins the recurrence word this locale's copy actually uses.
   * Substrings are chosen long enough not to hit by accident: Turkish "ayda"
   * rather than the bare "ay", Japanese "月額" rather than "月".
   */
  const MONTHLY: Record<SupportedLanguage, string> = {
    ar: 'شهريًا',
    de: 'im Monat',
    en: 'a month',
    es: 'al mes',
    fr: 'par mois',
    id: 'per bulan',
    ja: '月額',
    pt: 'por mês',
    ru: 'в месяц',
    tr: 'ayda',
  };

  it('anchors against the same monthly range in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const subtitle = String(bundleFor(language).export.paywall.subtitle);

      expect(rangeIn(subtitle), `${language} subtitle anchors a range`).toEqual(['5', '10']);
      expect(subtitle, `${language} subtitle says the range is monthly`).toContain(
        MONTHLY[language]
      );
    }
  });

  // Separate assertion from the range: the anchor only works if our own price
  // stands next to it. A subtitle that quotes the category and forgets to say
  // what we charge is an advert for the competition.
  it('states our one-time price beside the range', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const subtitle = String(bundleFor(language).export.paywall.subtitle);

      expect(amountsIn(subtitle), `${language} subtitle quotes our price`).toContain('7');
    }
  });
});

// The refund promise is the counterparty to the price: it is stated in the
// purchase UI, mirrored in the Terms of Service (§2.1, pinned by
// TermsOfService.test), and the two must say the same window. PaywallModal
// splits this string on the address to make it a mailto link, so a locale that
// drops the placeholder loses the link and leaves the buyer no way to ask.
describe('paywall refund copy', () => {
  const WINDOW_DAYS = '30';

  it('gives every language the refund address and the same window', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const refund = String(bundleFor(language).export.paywall.refund);

      expect(refund, `${language} refund names the address`).toContain('{{email}}');
      expect(refund.match(/\d+/g) ?? [], `${language} refund states the window`).toContain(
        WINDOW_DAYS
      );
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
