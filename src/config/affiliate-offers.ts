/**
 * Affiliate offers and the locale that resolves to each.
 *
 * The network's included-location list is shared across its offers — Coveron
 * (1025) and NordVPN (15) publish byte-identical lists of 234 entries — and it
 * omits Russia, China, Turkey, Belarus and every higher-income Arabic market.
 * Two dedicated offers cover exactly those gaps, which is why routing by locale
 * is worth doing at all rather than simply hiding the block.
 *
 * Locale is a language signal, not a country signal, so every mapping is an
 * approximation: `ru` resolves to an offer that excludes Kazakhstan even though
 * the main offer includes it. Each locale is mapped to its dominant country and
 * the minority is knowingly lost. Do not read more precision into this than that.
 *
 * Rate cards are identical across 15, 226 and 1025 — 100% CPS on a 1-month new
 * purchase, 40% on longer new purchases, 30% on renewals — so offer choice is a
 * message-match question, not a revenue one.
 */

export interface AffiliateCreative {
  /** Self-hosted path under `public/`. Never a third-party URL: hot-linking
   *  would send every visitor's IP to the network before any click. */
  src: string;
  width: number;
  height: number;
}

export interface AffiliateOffer {
  /** Stable id; also the analytics dimension. */
  id: string;
  /** i18n copy group. Shared by offers selling the same product. */
  copyKey: string;
  /** Official tracking URL. Empty string disables the placement entirely. */
  url: string;
  /** Present only where the network has a usable creative attached. */
  creative?: AffiliateCreative;
}

/** Offer 15 — 232 locations, the near-global default. Has 42 creatives attached. */
const NORDVPN_GLOBAL: AffiliateOffer = {
  id: 'nordvpn_global',
  copyKey: 'nordvpn',
  url: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=143131',
  creative: { src: '/affiliate/nordvpn-300x250.webp', width: 300, height: 250 },
};

/** Offer 226 — Turkey, the Gulf, North Africa, Iran, Afghanistan. No creatives confirmed. */
const NORDVPN_ARABIA: AffiliateOffer = {
  id: 'nordvpn_arabia',
  copyKey: 'nordvpn',
  url: 'https://go.getnord.net/aff_c?offer_id=226&aff_id=143131',
};

/** Offer 153 — Belarus, China, Russian Federation, and nothing else. No creatives confirmed. */
const NORDVPN_CIS: AffiliateOffer = {
  id: 'nordvpn_cis',
  copyKey: 'nordvpn',
  url: 'https://get.affiliatescn.net/aff_c?offer_id=153&aff_id=143131',
};

/** Only the locales whose dominant country the main offer excludes. */
const OFFER_BY_LANGUAGE: Readonly<Record<string, AffiliateOffer>> = {
  ru: NORDVPN_CIS,
  tr: NORDVPN_ARABIA,
  ar: NORDVPN_ARABIA,
};

/**
 * The offer to show for a language tag, or `null` when the placement is off.
 *
 * Accepts region-tagged values (`ru-RU`) because i18next reports them.
 */
export function resolveAffiliateOffer(language: string): AffiliateOffer | null {
  const base = language.toLowerCase().split('-')[0] ?? '';
  const offer = OFFER_BY_LANGUAGE[base] ?? NORDVPN_GLOBAL;
  return offer.url.length > 0 ? offer : null;
}
