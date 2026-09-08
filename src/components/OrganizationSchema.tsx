import { useLocation } from 'react-router-dom';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BASE_URL = 'https://safeunfollow.app';
const GITHUB_URL = 'https://github.com/ignromanov/safe-unfollow';
const CRUNCHBASE_URL = 'https://www.crunchbase.com/organization/safeunfollow';

/**
 * One stable identifier for the publisher, referenced everywhere it is named.
 *
 * Before this existed the file minted **three** anonymous `Organization` nodes — the standalone
 * one, `author`, and `provider` — all called "SafeUnfollow" and none of them the same node to a
 * consumer building an entity graph. Measured 2026-09-07: four of five AI engines resolve the
 * string "SafeUnfollow" to an unrelated Chrome extension, so publishing three unlinked stubs of
 * ourselves is the last thing this entity needs.
 * `.claude/analytics/2026-09-07-entity-resolution/00-the-entity-defects.md` §3(a).
 */
const ORGANIZATION_ID = `${BASE_URL}/#organization`;
const APPLICATION_ID = `${BASE_URL}/#app`;

/**
 * Profiles that identify *this* entity, not its maintainer.
 *
 * ⛔ Two entries, and the second one is here because it was *observed* rather than submitted.
 * Crunchbase joined 2026-09-07 after the operator opened the profile signed out and got the
 * filled page back. AlternativeTo and SaaSHub were filled the same evening and still read
 * "waiting to be reviewed", so they are deliberately absent: a filled form is not a published
 * assertion about this entity, and `sameAs` may only claim assertions that exist.
 *
 * ⚠️ An anonymous `curl` is not the instrument for that check. Crunchbase answers it 403 whatever
 * User-Agent it carries — a bot block, not a verdict on visibility — so the admissible reading is
 * a signed-out browser.
 *
 * Still queued, each blocked on a profile being created or an editor approving one —
 * AlternativeTo, opensourcealternative.to, SaaSHub — ranked in `00-the-entity-defects.md` §5, and
 * the Product Hunt listing URL (which exists: Search Console lists `producthunt.com` among our
 * linking hosts) has to be recovered from GSC before it can go here.
 *
 * ⚠️ `buymeacoffee.com/ignromanov` is deliberately **not** here, having been proposed and
 * withdrawn the same day. `sameAs` asserts that two URLs name the same entity; that page names a
 * person, and this node is an organisation. On an entity whose whole problem is a name collision,
 * a merely adjacent profile adds noise in exactly the dimension that is already broken.
 */
const SAME_AS = [GITHUB_URL, CRUNCHBASE_URL];

/**
 * The answer to "what is SafeUnfollow", and until 2026-09-07 it named no product.
 *
 * It read "Privacy-first tools for social media data analysis. All processing happens locally in
 * your browser." — no Instagram, no unfollowers, no web app, no domain. "SafeUnfollow" is this
 * Organization's *primary* name and only the application's `alternateName`, so a name match lands
 * here first, on the vaguest description we publish. Gemini answers the same question with the
 * namesake Chrome extension, whose store description is more specific than this one was.
 */
const ORGANIZATION_DESCRIPTION =
  'SafeUnfollow is a free web app that reads the official Instagram data export in your browser ' +
  'and shows who unfollowed you, who does not follow back, and who is mutual. The export is ' +
  'parsed on your own device and never uploaded, and no Instagram login is required.';

/**
 * `disambiguatingDescription` is schema.org's own field for "a short description of the item used
 * to disambiguate from other, similar items". A separately published Chrome extension shares this
 * name and automates unfollowing inside a live Instagram session — behaviour our positioning
 * exists to warn against — and three of five engines attribute it to us. This is the one property
 * in the vocabulary aimed at that, and it was unused.
 */
const DISAMBIGUATING_DESCRIPTION =
  'SafeUnfollow is the web app at safeunfollow.app. It is not a browser extension, it does not ' +
  'act inside an Instagram session, and it never follows or unfollows anyone on your behalf.';

/**
 * Organization and SoftwareApplication schema for SEO
 * Provides structured data about the app for rich SERP results
 * Includes E-E-A-T signals: license, version, repository
 */
export function OrganizationSchema() {
  const location = useLocation();

  // Only render on home page to avoid duplicate schemas
  const isHomePage =
    location.pathname === '/' || location.pathname.match(/^\/[a-z]{2}\/?$/) !== null;

  if (!isHomePage) {
    return null;
  }

  // Organization schema - who made this
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'SafeUnfollow',
    alternateName: 'Instagram Unfollow Tracker',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    sameAs: SAME_AS,
    description: ORGANIZATION_DESCRIPTION,
    disambiguatingDescription: DISAMBIGUATING_DESCRIPTION,
  };

  /**
   * `author`, `provider` and `publisher` are written out in full *and* carry the shared `@id`.
   *
   * Deliberately belt-and-braces. A consumer that merges by `@id` sees one organisation; a
   * consumer that does not still receives a complete node and needs to resolve nothing. The GEO
   * plan of 2026-09-04 (§4 A1) refused `Organization` on the docs surface precisely because
   * cross-document `@id` resolution could not be confirmed from a primary source — that objection
   * is answered by never requiring resolution, not by dropping the identifier.
   */
  const publisherRef = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'SafeUnfollow',
    url: BASE_URL,
  };

  // SoftwareApplication schema - what this app is
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': APPLICATION_ID,
    name: 'Instagram Unfollow Tracker',
    alternateName: 'SafeUnfollow',
    applicationCategory: 'UtilityApplication',
    applicationSubCategory: 'Privacy Tool',
    operatingSystem: 'Web Browser',
    // Derived, never typed: this field read '1.5.0' while package.json said '1.6.0'. A hardcoded
    // copy of a fact that lives somewhere else is the defect class CLAUDE.md bans by name, and a
    // stale version is a freshness anti-signal on a surface whose whole point is freshness.
    // `__PKG_VERSION__` is the semver; `__APP_VERSION__` is a commit sha in production builds and
    // is the wrong shape for this property.
    softwareVersion: __PKG_VERSION__,
    browserRequirements: 'Requires JavaScript and a browser with IndexedDB support.',
    inLanguage: [...SUPPORTED_LANGUAGES],
    url: BASE_URL,
    downloadUrl: BASE_URL,
    screenshot: `${BASE_URL}/og-image.png`,
    datePublished: '2025-11-22',
    license: 'https://opensource.org/licenses/MIT',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: publisherRef,
    provider: publisherRef,
    publisher: publisherRef,
    featureList: [
      'Find who unfollowed you on Instagram',
      'Analyze up to 1,000,000+ accounts',
      '100% local processing - data never leaves your device',
      'No login or password required',
      'Uses official Instagram data export (ZIP file)',
      'Free and open-source (MIT license)',
      'Works offline after loading',
    ],
    keywords:
      'instagram unfollow tracker, who unfollowed me on instagram, instagram unfollowers, instagram data export analyzer',
  };

  // Safe: JSON.stringify escapes special chars, data is hardcoded (not user input)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSchema),
        }}
      />
    </>
  );
}
