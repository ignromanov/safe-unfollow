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

/** The price exactly as this locale spells it, symbol placement included. */
function priceTokenIn(text: string): string | undefined {
  return /\d+(?:[.,]\d{2})?\s*\$|\$\s*\d+(?:[.,]\d{2})?/.exec(text)?.[0];
}

/**
 * Any amount with a currency attached, in whichever order the locale writes it.
 *
 * Wider than the dollar-only sweep this file used to run, and it has to be:
 * the amounts it guards against are no longer only dollars. The set covers
 * every symbol the price table can produce plus the ones a translator reaches
 * for unprompted — a locale that "helpfully" converts $7 into its own currency
 * is exactly the drift the interpolation exists to stop, and a dollar-only
 * regex would wave it through.
 */
function currencyAmountIn(text: string): string | undefined {
  const CURRENCY = '[$€£¥₹₱₺]|Rp|IDR|USD|EUR|PHP|INR';
  return new RegExp(`(?:${CURRENCY})\\s?\\d|\\d\\s?(?:${CURRENCY})`).exec(text)?.[0];
}

/**
 * The names a string asks its renderer to fill.
 *
 * The name is taken up to the first comma so i18next's formatting suffix
 * (`{{count, number}}`) is read as the value it names rather than as a value
 * nothing supplies.
 */
function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
    .map(match => (match[1] ?? '').split(',')[0]?.trim() ?? '')
    .sort();
}

// The price lives in Dodo's dashboard, so no test can prove the copy matches
// what the buyer is actually charged. What a test can prove is that no locale
// drifts away from the others — which is what this file has always done, and
// what it still does. Only the shape of agreement changed.
//
// It used to be "all ten quote $7". That premise died when the price stopped
// being one number: a buyer in Jakarta is charged Rp50.000 and one in Manila
// ₱150, resolved from the browser's timezone at render time (country-price.ts).
// A bundle that spelled any of those out would be right for one country and a
// false advertisement in the other nine, so the amount left the bundles
// entirely and `{{price}}` took its place. The invariant is now the stronger
// one: the copy states the price it is *given*, and states no other.
//
// The original risk is unchanged and is why the sweep is still ten-wide. The
// price moved $3 → $7 by a regex over files whose currency formats differ
// (`$7`, `7 $`, `7$`); a locale missed by such a sweep advertises a price this
// product does not sell at. A locale missed by this change does something
// worse — it quotes dollars to a reader being charged rupiah.
describe('paywall price copy', () => {
  // `subtitle` used to be excluded from this sweep: it carried the contrast
  // anchor, whose $5–10 was price-shaped but not our price, so a
  // no-hardcoded-amount rule could not be applied to the string as a whole.
  // That reason expired when the anchor itself became a value — it now
  // resolves from the same per-country table as `price`
  // (`getRivalMonthlyRange`), so a locale hardcoding either amount is exactly
  // the drift this sweep exists to catch, and `subtitle` rejoins it.
  it('interpolates the price rather than spelling it out, in every language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const paywall = bundleFor(language).export?.paywall;

      expect(paywall?.terms, `${language} terms`).toBeTruthy();
      expect(paywall?.cta, `${language} cta`).toBeTruthy();
      expect(paywall?.subtitle, `${language} subtitle`).toBeTruthy();

      for (const text of [paywall.terms, paywall.cta, paywall.subtitle]) {
        expect(String(text), `${language} takes the price as a value`).toContain('{{price}}');
        expect(
          currencyAmountIn(String(text)),
          `${language} hardcodes an amount in "${text}"`
        ).toBeUndefined();
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
      // `export.saved.capped` names the file the free-tier click just wrote
      // and interpolates the same FREE_EXPORT_ROWS constant. It is now the only
      // place in this flow that states the cap in a sentence, so it carries the
      // whole guard: the hero pair renders its numerals from the constant and
      // from props, which no locale can drift.
      const savedCapped = String(bundleFor(language).export.saved.capped);
      expect(savedCapped, `${language} export.saved.capped`).toContain('{{rows}}');
      expect(savedCapped, `${language} export.saved.capped`).toContain('{{total}}');

      // The third placeholder, guarded for a different reason than the other
      // two. `{{filename}}` is the only value on this screen the *user*
      // controls, and the renderer wraps it in bidi isolates before handing it
      // over. A locale that drops the placeholder does not merely lose the
      // filename — it loses the isolation with it, and the sentence stops
      // naming the file it exists to name.
      expect(savedCapped, `${language} export.saved.capped`).toContain('{{filename}}');

      // `gap` is the one line that survives the bar being hidden from assistive
      // technology, so it is the only statement of the boundary a screen reader
      // reaches. It states both ends: the row the free file stops at, and the
      // total the export takes. A locale that spells either out keeps saying
      // "row 10" after the constant moves, to the one reader who cannot check
      // it against the picture.
      const gap = String(bundleFor(language).export.paywall.gap);
      expect(gap, `${language} paywall.gap`).toContain('{{rows}}');
      expect(gap, `${language} paywall.gap`).toContain('{{total}}');

      // The legend labels the segment whose width is computed from the same
      // constant, so a hardcoded count here contradicts the picture beside it
      // rather than merely going stale.
      const legend = String(bundleFor(language).export.paywall.legendSample);
      expect(legend, `${language} paywall.legendSample`).toContain('{{rows}}');
    }
  });

  // The headline stopped interpolating when the numerals moved into the hero
  // pair, and i18next leaves an unknown placeholder in the output verbatim. A
  // locale left on the old string therefore shows a buyer literal `{{rows}}` on
  // the screen that asks for money — valid JSON, valid string, visible bug.
  // `instantNote` is in the sweep too: it lives in this namespace but is
  // rendered by `LicenseDialog`, and it takes no values either.
  //
  // Stated per key rather than as a flat whitelist of key names, which is a
  // change the price forced and would have been worth making anyway. A
  // whitelist answers "may this key interpolate?" — and once `cta` and `terms`
  // are on it, a locale that drops `{{price}}` and leaves `{{rows}}` in its
  // place passes, as does one that drops the placeholder from `cta` entirely
  // while another key on the list still has one. Naming the values each key
  // takes answers the question the renderer actually asks, in both directions:
  // nothing unfilled reaches the screen, and nothing the renderer supplies goes
  // unstated. An empty list is a real entry — it says this key takes no values.
  it('takes exactly the values its renderer supplies, and no others', () => {
    const VALUES: Record<string, string[]> = {
      cta: ['price'],
      terms: ['price'],
      // Both amounts in this sentence are now values: `price` is ours,
      // `rivals` is the category's monthly range, and both resolve from the
      // same per-country table so they can never disagree on currency.
      subtitle: ['price', 'rivals'],
      refund: ['email'],
      gap: ['rows', 'total'],
      legendSample: ['rows'],
    };

    for (const language of SUPPORTED_LANGUAGES) {
      const paywall = bundleFor(language).export.paywall as Record<string, string>;

      for (const [key, value] of Object.entries(paywall)) {
        expect(placeholdersIn(String(value)), `${language} paywall.${key}: "${value}"`).toEqual(
          VALUES[key] ?? []
        );
      }
    }
  });

  // The label sits under a numeral the component renders, and the two are read
  // as one sentence — Radix takes the dialog's accessible name from both. A
  // locale that writes its own count into the label ("1.284 Konten") states a
  // number that is true for one reader and wrong for everybody else, and it is
  // too short for a reviewer to notice it drifting.
  it('keeps the list label free of counts', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const label = String(bundleFor(language).export.paywall.listLabel);

      expect(label, `${language} listLabel`).toBeTruthy();
      expect(/\d/.test(label), `${language} listLabel: "${label}"`).toBe(false);
    }
  });
});

// The subtitle is the only place the buyer is given something to compare our
// price against. The comparison is to what the category charges, resolved
// per country (`country-price.ts`'s `RIVAL_MONTHLY_BY_COUNTRY` /
// `DEFAULT_RIVAL_MONTHLY`) rather than restated here — see that file's own
// comment for sources. It is a comparison of pricing *models*, because none
// of those trackers sells a data export at all; a locale that turned it into
// a feature comparison would be making a false claim, and that a test cannot
// catch. The range invariants (currency agreement, low < high) live in
// `country-price.test.ts`, where both halves of the comparison are computed
// and can be checked against each other. What this file still owns is the
// locale copy: that the recurrence word is present, and that both amounts
// are values, not literals.
describe('paywall contrast anchor', () => {
  /**
   * Proof, per language, that the range is a *monthly* rate.
   *
   * A numeral-only check passes "{{rivals}} once", which inverts the
   * comparison, so each entry pins the recurrence word this locale's copy
   * actually uses. Substrings are chosen long enough not to hit by accident:
   * Turkish "ayda" rather than the bare "ay", Japanese "月額" rather than "月".
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

      expect(subtitle, `${language} subtitle says the range is monthly`).toContain(
        MONTHLY[language]
      );
    }
  });

  // Separate assertion from the recurrence word: the anchor only works if our
  // own price stands next to it. A subtitle that quotes the category and
  // forgets to say what we charge is an advert for the competition. Each
  // placeholder is checked for exactly-once, the same way — a second
  // occurrence of either would mean a locale duplicated the sentence rather
  // than translating it.
  it('takes our price and the rival range as values, each exactly once', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const subtitle = String(bundleFor(language).export.paywall.subtitle);

      for (const placeholder of ['price', 'rivals']) {
        expect(subtitle, `${language} subtitle takes ${placeholder} as a value`).toContain(
          `{{${placeholder}}}`
        );
        expect(
          subtitle.match(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'))?.length,
          `${language} subtitle interpolates ${placeholder} once`
        ).toBe(1);
      }
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
      const terms = String(bundleFor(language).export.paywall.terms);

      // Any digit that is not part of the price — the price test owns that one.
      const withoutPrice = terms.replace(/\d+(?:[.,]\d{2})?\s*\$|\$\s*\d+(?:[.,]\d{2})?/g, '');
      const numbers = withoutPrice.match(/\d+/g) ?? [];

      expect(numbers, `${language} terms states a device count`).toContain(DEVICES);
    }
  });
});

// The handoff restates the purchase at the moment the reader leaves for a
// third-party domain, which makes it the last place a wrong number can be
// corrected — and the first place a translator sees the price out of context.
// Two things are pinned, and the second is the one nothing else in this repo
// checks: a dropped `{{rows}}` renders the literal braces to the buyer, and no
// locale gate catches a lost interpolation (GH#70's neighbour).
describe('checkout handoff summary', () => {
  // This is the last screen we own before the reader is on the processor's
  // domain, so it is also the last place our number can be checked against
  // theirs — and the two are now the same number by construction, both read off
  // one resolved country. A hardcoded amount here would be the one place the
  // buyer could catch us contradicting the page they are about to land on.
  it('interpolates the price rather than spelling it out, in every language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const summary = String(bundleFor(language).export.checkout.summary);

      expect(summary, `${language} handoff summary takes the price as a value`).toContain(
        '{{price}}'
      );
      expect(
        currencyAmountIn(summary),
        `${language} handoff summary hardcodes an amount: "${summary}"`
      ).toBeUndefined();
    }
  });

  it('keeps the row-count placeholder every language interpolates', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const summary = String(bundleFor(language).export.checkout.summary);

      expect(summary, `${language} handoff summary names the row count`).toContain('{{rows}}');
    }
  });
});
