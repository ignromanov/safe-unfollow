/**
 * The three intent landing pages: slug, the badge each one hands the reader into, and the
 * heading the page is about.
 *
 * IMPORTANT: This file must have NO runtime imports. scripts/generate-sitemap.ts imports
 * it, and tsx runs that outside Vite, where the `@/` alias does not resolve. The BadgeKey
 * import below is `import type` and is erased at compile time; src/config/languages.ts states
 * the same rule for itself and for the same reason.
 *
 * English only. These are registered on the root route object alone (src/routes.tsx) — a page
 * added to createPageChildren() would ship in ten locales.
 */
import type { BadgeKey } from '../core/types/badges';

export interface IntentPageConfig {
  /**
   * URL path without a leading slash, and the `?from=` value. One string, both jobs.
   *
   * Two of the three slugs below carry an `instagram-` prefix and one does not, and that is
   * deliberate rather than inconsistent: each slug mirrors its own query rather than a house
   * naming convention. "pending follow requests" and "mutual followers" are both ambiguous
   * across platforms, so the prefix disambiguates them; "who doesn't follow me back" is
   * already a self-identifying question, and the prefix would only lengthen the URL for no
   * gain in clarity. The page's `h1` and title carry "on Instagram" regardless of the slug.
   */
  slug: string;
  /** The filter the CTA pre-applies. */
  badge: BadgeKey;
  /** The page's single h1. Must not collide with any other h1 on the property (#188). */
  h1: string;
  /**
   * The same page named inside a running sentence, in the reader's words rather than ours.
   * Used by the English home page's "Also answers:" line (task 5) — the h1 does not fit in a
   * comma-separated list, and a hand-written anchor there would be a second name for this page
   * that nothing keeps in sync.
   */
  shortLabel: string;
}

export const INTENT_PAGES = [
  {
    slug: 'who-doesnt-follow-me-back',
    badge: 'notFollowingBack',
    h1: "Who Doesn't Follow You Back on Instagram",
    shortLabel: "who doesn't follow you back",
  },
  {
    slug: 'instagram-pending-follow-requests',
    badge: 'pending',
    h1: 'Your Pending Instagram Follow Requests',
    shortLabel: 'which requests are still pending',
  },
  {
    slug: 'instagram-mutual-followers',
    badge: 'mutuals',
    h1: 'Your Mutual Followers, From Your Own Export',
    shortLabel: 'who follows you back',
  },
] as const satisfies readonly IntentPageConfig[];

/**
 * The slugs as a union rather than as `string`.
 *
 * `as const satisfies` rather than a `readonly IntentPageConfig[]` annotation: the annotation
 * would widen every `slug` to `string`, and this union is what makes `cta={page.slug}` on
 * PrefixedLink a checked value instead of a hopeful one (task 6). The idiom is already the
 * house one — see instagram-html-dates.ts:157, LicenseDialog.tsx:67, PaywallModal.tsx:27.
 */
export type IntentSlug = (typeof INTENT_PAGES)[number]['slug'];

/** `/slug` for each page — the shape the sitemap generator and the meta injector match on. */
export const INTENT_PATHS: readonly string[] = INTENT_PAGES.map(p => `/${p.slug}`);
