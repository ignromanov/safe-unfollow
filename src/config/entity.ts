/**
 * The non-affiliation sentence, licensed verbatim by velum-cdpo
 * (`.claude/plans/2026-11-09-seo-aeo-geo/plan/velum-verdicts.md` Q1).
 *
 * One source: `OrganizationSchema.tsx` builds `disambiguatingDescription` from it, and
 * `src/__tests__/docs/llms-txt-entity.test.ts` pins every hand-written copy equal to it —
 * `docs/_config.yml`, `public/llms.txt`, `en/faq.json` `notAffiliated`, and `docs/faq.md`.
 * Plain text only: never a link and never a URL-typed field, in any locale.
 *
 * ⛔ The sentence is the operator's representation of a fact (no relationship with either
 * party). Changing it is velum-cdpo's ruling and the operator's confirmation, not a copy edit.
 */
export const NON_AFFILIATION =
  'SafeUnfollow.app is not affiliated with safeunfollow.com or with any browser extension named SafeUnfollow.';

/**
 * One `@id` per entity node. `OrganizationSchema.tsx` defines the nodes; every other JSON-LD block
 * on a page (FAQPage, HowTo, an intent page's WebPage) points at them with a bare `{'@id': …}`, so
 * a consumer joins the separate `<script>` blocks into one graph instead of reading islands.
 * `docs/_config.yml` builds the same ids; `jekyll-structured-data.test.ts` keeps them equal.
 */
const SITE_URL = 'https://safeunfollow.app';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const FOUNDER_ID = `${SITE_URL}/#founder`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
