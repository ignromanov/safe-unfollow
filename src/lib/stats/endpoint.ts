/**
 * Resolves the self-hosted Umami instance from the tag that loaded it.
 *
 * Neither value is a build-time constant worth duplicating: the tag is injected
 * at runtime by `loadUmami()`, and the website id has already changed once (the
 * Neon to Supabase migration). Reading both back off the DOM keeps one source
 * of truth, and its absence doubles as the signal that analytics is not live —
 * the opt-out path never injects the tag at all.
 */
export interface UmamiTarget {
  /**
   * Base URL the instance is served from: the script tag's **directory**, not
   * its origin.
   *
   * This mirrors Umami's own tracker, which derives its collect endpoint as
   * `currentScript.src.split('/').slice(0, -1).join('/')`. The two agree only by
   * accident when the script sits at an origin root, where directory and origin are
   * the same string.
   *
   * ⛔ As of 2026-09-14 that accident is back: the same-origin proxy `/v/` was removed
   * and the tag is served from `https://m.safeunfollow.app/script.js`, so substituting
   * origin for directory would now be **invisible in production**. It was not before —
   * `/v/script.js` has origin `https://safeunfollow.app` but base
   * `https://safeunfollow.app/v`, and using the origin posted every custom event outside
   * the proxied path while Umami's own pageviews kept working, so the dashboard looked
   * healthy and every custom event 404'd. The nested fixture in
   * `src/__tests__/lib/stats/endpoint.test.ts` is now the only thing that catches it.
   */
  baseUrl: string;
  websiteId: string;
}

export function resolveUmamiTarget(): UmamiTarget | null {
  if (typeof document === 'undefined') return null;

  const scriptEl = document.querySelector('script[data-website-id]');
  const websiteId = scriptEl?.getAttribute('data-website-id');
  const src = scriptEl?.getAttribute('src');
  if (!websiteId || !src) return null;

  try {
    const { href } = new URL(src, window.location.href);
    return { baseUrl: href.slice(0, href.lastIndexOf('/')), websiteId };
  } catch {
    return null;
  }
}
