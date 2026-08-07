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

export interface AffiliateCreativeVariant {
  /** Self-hosted path under `public/`. Never a third-party URL: hot-linking
   *  would send every visitor's IP to the network before any click.
   *
   *  Versioned filename (`-v2-`) because `vercel.json` caches `/affiliate/*`
   *  immutably for a year: reusing a path would leave returning visitors on the
   *  old creative until the cache expired. The name is the version. */
  src: string;
  /** Intrinsic pixels, verified against the file itself by
   *  `__tests__/assets/affiliate-creative.test.ts` — a wrong value here is a
   *  wrong aspect-ratio reservation, which is a layout shift no test that only
   *  looks at markup can see. */
  width: number;
  height: number;
}

export interface AffiliateCreative {
  /** Below `lg`, and the fallback wherever no `<source>` matches. */
  base: AffiliateCreativeVariant;
  /** From `lg` up, where the upload column measures roughly 750px and a 300px
   *  box fills under half of it. Optional: an offer may ship one cut only.
   *
   *  Pick this by AREA, not by width. A 728×90 leaderboard closed 96% of the
   *  column and still read as smaller than the box it replaced — 65 520 px²
   *  against the base cut's 75 000. The 970×250 billboard lands at roughly
   *  750×193 in this column: 2.2× the leaderboard's area, and a 0.77 downscale
   *  keeps its headline legible where the square cut's sub-text turned to mush. */
  wide?: AffiliateCreativeVariant;
}

/**
 * The one creative set we hold, cut by the network for offer 15.
 *
 * Offers 226 and 153 have no creatives of their own and borrow it. That is a
 * deliberate call taken 2026-08-07 and **not confirmed with the network**: if
 * creatives are bound to an offer id rather than to the account, showing this
 * one beside a 153/226 tracking link is outside the terms. Reverting is one
 * property per offer — do not let this comment rot into an established fact.
 */
const NORDVPN_CREATIVE: AffiliateCreative = {
  base: { src: '/affiliate/nordvpn-v2-300x250.webp', width: 300, height: 250 },
  wide: { src: '/affiliate/nordvpn-v2-970x250.webp', width: 970, height: 250 },
};

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

/** Offer 15 — 232 locations, the near-global default. Owns the creative above. */
const NORDVPN_GLOBAL: AffiliateOffer = {
  id: 'nordvpn_global',
  copyKey: 'nordvpn',
  url: 'https://go.nordvpn.net/SHAow',
  creative: NORDVPN_CREATIVE,
};

/** Offer 226 — Turkey, the Gulf, North Africa, Iran, Afghanistan. Borrows the creative. */
const NORDVPN_ARABIA: AffiliateOffer = {
  id: 'nordvpn_arabia',
  copyKey: 'nordvpn',
  url: 'https://go.getnord.net/SHBsa',
  creative: NORDVPN_CREATIVE,
};

/** Offer 153 — Belarus, China, Russian Federation, and nothing else. Borrows the creative. */
const NORDVPN_CIS: AffiliateOffer = {
  id: 'nordvpn_cis',
  copyKey: 'nordvpn',
  // The network lists this one as plain `http`. Upgraded to `https` here: the
  // host serves a valid certificate (verified 2026-08-07), and a cleartext hop
  // would contradict the very line this placement sells — that the ISP sees
  // every site you open.
  url: 'https://get.affiliatescn.net/SHBvA',
  creative: NORDVPN_CREATIVE,
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
