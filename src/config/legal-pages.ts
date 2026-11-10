/**
 * The legal pages, served in English only since v1.7.0 (plan 2026-11-09-seo-aeo-geo, task 08a).
 *
 * `PrivacyPolicy.tsx` and `TermsOfService.tsx` are hard-coded English with no `t()`, so a
 * `/es/privacy` under an `es` hreflang claimed a Spanish policy that does not exist. Every locale
 * variant is now a 308 to the English page in `public/_redirects` (gated against
 * `SUPPORTED_LANGUAGES` by `redirects.test.ts`). The routes, `PrefixedLink`, the meta injector
 * and the sitemap generator read this list rather than restating it.
 */
export const LEGAL_PATHS: readonly string[] = ['/privacy', '/terms'];

/** True for `/privacy`, `/terms` and either with a query string or fragment. */
export function isLegalPath(to: string): boolean {
  return LEGAL_PATHS.includes(to.split(/[?#]/)[0]!);
}
