/**
 * Build-time feature flags.
 *
 * Plain constants rather than `VITE_*` env vars: Vite inlines env values at
 * build time anyway, so an env var buys no runtime switch, and it hides the
 * current state from anyone reading the source.
 */

/**
 * The rescue-plan banner.
 *
 * Off since 2026-07-29. It was the third promo surface between the visitor's
 * stats and the account list they came for, and AdSense is now the primary
 * surface — so it yields its grid slot to the ad. Component, hooks, i18n and its
 * four affiliate links are all retained: flip this back to `true` to restore it.
 */
export const RESCUE_PLAN_BANNER_ENABLED = false;
