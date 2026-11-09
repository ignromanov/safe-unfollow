import { useLocation } from 'react-router-dom';

import { NON_AFFILIATION } from '@/config/entity';
import { SUPPORTED_LANGUAGES, createLanguagePrefixRegex } from '@/config/languages';

const BASE_URL = 'https://safeunfollow.app';
const GITHUB_URL = 'https://github.com/ignromanov/safe-unfollow';

/**
 * The Zenodo **concept** DOI, minted 2026-09-08 with the first release. It always resolves to the
 * newest version; the version DOI (`…22663616`) pins v1.6.0. `CITATION.cff` carries the same
 * concept DOI and for the same reason (#230). Used twice below: as the software's `identifier`,
 * and as a `sameAs` URL on the Organization.
 */
const ZENODO_CONCEPT_DOI = '10.5281/zenodo.22663615';

/**
 * One stable identifier per node, and every other mention of that node is a bare `{'@id': …}`.
 *
 * Before 2026-09-07 the file minted three anonymous `Organization` nodes — the standalone one,
 * `author`, and `provider` — none of them the same node to a consumer building an entity graph.
 * Since v1.7.0 every node sits in one `@graph` on the same page, so a reference resolves inside
 * the document and needs no inline copy. `docs/_config.yml` builds the same ids from the same
 * site URL; `jekyll-structured-data.test.ts` keeps the two surfaces equal.
 * `.claude/analytics/2026-09-07-entity-resolution/00-the-entity-defects.md` §3(a).
 */
const ORGANIZATION_ID = `${BASE_URL}/#organization`;
const FOUNDER_ID = `${BASE_URL}/#founder`;
const SOFTWARE_ID = `${BASE_URL}/#software`;
const WEBSITE_ID = `${BASE_URL}/#website`;

const ALTERNATE_NAMES = ['SafeUnfollow.app', 'Instagram Unfollow Tracker'];

/**
 * Profiles that identify *this* entity, not its maintainer. Order and values fixed by lumen-cro in
 * `.claude/plans/2026-11-09-seo-aeo-geo/plan/01-entity-schema.md`.
 *
 * ⛔ `sameAs` may only claim assertions that exist and can be indexed, and filled, reachable and
 * indexable are three separate facts. Measured 2026-09-08: SaaSHub served a complete profile under
 * a `noindex` meta; AlternativeTo 404'd to the public while the signed-in submitter saw a page. The
 * check is a fetch, never "the operator can see it". An anonymous `curl` is not always the
 * instrument either: Crunchbase answers it 403 whatever the User-Agent, so a 403 needs a control
 * fetch of a nonsense slug on the same host before it is read as a verdict.
 *
 * ⛔ The Zenodo entry is the **concept** DOI, which always resolves to the newest version. The
 * redirect lands on the version record (`zenodo.org/records/22663616` at v1.6.0); pasting what the
 * browser shows pins one release and is falsified by the next — the event during which nobody
 * rereads this file. Cleared for `sameAs` 2026-09-14 (200, `/records/` not disallowed by robots).
 *
 * ⚠️ `buymeacoffee.com/ignromanov` stays out: it names a person, and this node is an organisation.
 * The founder's own profiles belong on the Person node below.
 */
const SAME_AS = [
  GITHUB_URL,
  'https://www.crunchbase.com/organization/safeunfollow',
  'https://www.producthunt.com/products/instagram-unfollow-tracker',
  `https://doi.org/${ZENODO_CONCEPT_DOI}`,
  'https://www.instagram.com/safeunfollow',
];

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
 * exists to warn against — and three of five engines attribute it to us.
 *
 * Rewritten for v1.7.0 (plan task 01, lumen-cro's wording): the previous text was a three-item
 * negation list. The last sentence is velum-cdpo's licensed non-affiliation line, verbatim
 * (`plan/velum-verdicts.md` Q1/2b): it comes after the identity sentence, because engines drop
 * negations when they compress; it is plain text, never a link or a URL-typed field. The operator
 * confirms the fact before merge. `docs/_config.yml` carries the identical string, gated by
 * `jekyll-structured-data.test.ts`.
 */
const DISAMBIGUATING_DESCRIPTION =
  'SafeUnfollow is the web app at safeunfollow.app. It reads the Instagram data export you ' +
  `choose and never acts inside your Instagram account. ${NON_AFFILIATION}`;

/**
 * Base paths that carry no entity node: the two routes `public/_headers` serves with
 * `X-Robots-Tag: noindex`. Restated here because the component runs in the browser and cannot
 * read `_headers`; `src/__tests__/build/entity-graph.test.ts` derives the set from `_headers` and
 * fails when a prerendered page disagrees with it.
 */
const NO_ENTITY_PATHS = new Set(['/results', '/sample']);

const LANGUAGE_PREFIX = createLanguagePrefixRegex();

/**
 * The entity graph, one `@graph` in one script:
 *   - Organization + Person (founder) on every indexable route;
 *   - WebSite + SoftwareApplication on `/` and each `/:lang` home only;
 *   - nothing on `/results`, `/sample` and their locale variants.
 * Placement is lumen-cro's call, `.claude/plans/2026-11-09-seo-aeo-geo/plan/01-entity-schema.md`.
 */
export function OrganizationSchema() {
  const { pathname } = useLocation();
  const basePath = pathname.replace(LANGUAGE_PREFIX, '/').replace(/(.)\/+$/, '$1');

  if (NO_ENTITY_PATHS.has(basePath)) {
    return null;
  }

  const organization = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'SafeUnfollow',
    alternateName: ALTERNATE_NAMES,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    sameAs: SAME_AS,
    description: ORGANIZATION_DESCRIPTION,
    disambiguatingDescription: DISAMBIGUATING_DESCRIPTION,
    founder: { '@id': FOUNDER_ID },
  };

  const founder = {
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: 'Ignat Romanov',
    url: 'https://lasipan.cc/',
    jobTitle: 'Builder & Web3 Frontend Engineer',
    description:
      'Builder & Web3 Frontend Engineer — crafting privacy-first tools for the decentralized economy.',
    sameAs: [
      'https://github.com/ignromanov',
      'https://lasipan.cc/',
      'https://www.linkedin.com/in/ignat-romanov',
      'https://x.com/romignov',
    ],
  };

  const graph: object[] = [organization, founder];

  if (basePath === '/') {
    // Google still reads WebSite for the site name shown above a result. No SearchAction: the
    // sitelinks search box was retired in November 2024.
    graph.push({
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'SafeUnfollow',
      alternateName: ['SafeUnfollow.app', 'safeunfollow.app'],
      url: `${BASE_URL}/`,
      publisher: { '@id': ORGANIZATION_ID },
    });
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': SOFTWARE_ID,
      name: 'SafeUnfollow',
      alternateName: ALTERNATE_NAMES,
      disambiguatingDescription: DISAMBIGUATING_DESCRIPTION,
      applicationCategory: 'UtilityApplication',
      applicationSubCategory: 'Privacy Tool',
      operatingSystem: 'Web Browser',
      // Derived, never typed: this field read '1.5.0' while package.json said '1.6.0'.
      // `__PKG_VERSION__` is the semver; `__APP_VERSION__` is a commit sha in production builds.
      softwareVersion: __PKG_VERSION__,
      // CITATION.cff's date-released (vite/build-env.ts): a release date, never a build date.
      dateModified: __RELEASE_DATE__,
      browserRequirements: 'Requires JavaScript and a browser with IndexedDB support.',
      inLanguage: [...SUPPORTED_LANGUAGES],
      url: BASE_URL,
      downloadUrl: BASE_URL,
      screenshot: `${BASE_URL}/og-image.png`,
      datePublished: '2025-11-22',
      license: 'https://opensource.org/licenses/MIT',
      identifier: {
        '@type': 'PropertyValue',
        propertyID: 'DOI',
        value: ZENODO_CONCEPT_DOI,
      },
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      author: { '@id': FOUNDER_ID },
      provider: { '@id': ORGANIZATION_ID },
      publisher: { '@id': ORGANIZATION_ID },
      featureList: [
        'Find who unfollowed you on Instagram',
        'Analyze up to 1,000,000+ accounts',
        '100% local processing - data never leaves your device',
        'No login or password required',
        'Uses official Instagram data export (ZIP file)',
        'Free and open-source (MIT license)',
      ],
      keywords:
        'instagram unfollow tracker, who unfollowed me on instagram, instagram unfollowers, instagram data export analyzer',
    });
  }

  // Safe: JSON.stringify escapes special chars, data is hardcoded (not user input)
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
