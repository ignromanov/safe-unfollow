/**
 * Which country the buyer is checking out from, and what the price says there.
 *
 * The signal is the browser's own timezone. That is the only country signal
 * compatible with the privacy promise: an IP lookup is a request, and this page
 * makes none. It is also the only one that is about the *buyer* — locale is
 * not country and must not be used as one, because Indian and Philippine
 * readers are served the English bundle and `en` cannot carry a rupee price.
 *
 * One resolved country feeds both the price on our button and the `country=`
 * parameter on the checkout link, so display and checkout cannot disagree.
 * They are not two mechanisms kept in sync; they are one value read twice.
 */

export type CheckoutCountry = 'ID' | 'IN' | 'PH';

/**
 * Every IANA zone that resolves to a market with a local price.
 *
 * Indonesia spans four zones and all four are listed: a reader in Makassar is
 * as Indonesian as one in Jakarta, and only Jakarta is the obvious name.
 * `Asia/Calcutta` is the deprecated alias for `Asia/Kolkata` and is still what
 * some browsers report, so the map carries both rather than trusting that
 * every engine has migrated.
 */
const COUNTRY_BY_TIMEZONE: Record<string, CheckoutCountry> = {
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Manila': 'PH',
};

/**
 * What the buyer pays, spelled the way the checkout spells it.
 *
 * These are display strings, not amounts: the number and its symbol travel
 * together because the conversion is not ours to compute. Each one is set in
 * the processor's dashboard in its own currency and was read back off the live
 * checkout — a rate applied here would be a third exchange rate shipping
 * alongside two others, going stale on its own schedule.
 */
const PRICE_BY_COUNTRY: Record<CheckoutCountry, string> = {
  ID: 'Rp50.000',
  IN: '₹200',
  PH: '₱150',
};

/** The price everywhere the ladder does not reach — the base USD amount. */
const DEFAULT_PRICE = '$7';

/**
 * The buyer's country when it is one we price locally, otherwise null.
 *
 * Never throws. `Intl` is present in every browser this product supports, but
 * a resolver that can throw would take the paywall down with it for a saving
 * of nothing — and null is a complete answer, not a degraded one: it is what
 * every buyer outside the three markets gets anyway.
 */
export function resolveCheckoutCountry(): CheckoutCountry | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return COUNTRY_BY_TIMEZONE[timeZone] ?? null;
  } catch {
    return null;
  }
}

/** The price to print, for whichever country {@link resolveCheckoutCountry} found. */
export function getDisplayPrice(): string {
  const country = resolveCheckoutCountry();
  return country === null ? DEFAULT_PRICE : PRICE_BY_COUNTRY[country];
}
