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
   * `currentScript.src.split('/').slice(0, -1).join('/')`. The two agreed only
   * by accident while the script sat at an origin root, where directory and
   * origin are the same string. Behind the same-origin proxy they differ —
   * `/v/script.js` has origin `https://safeunfollow.app` but base
   * `https://safeunfollow.app/v` — and using the origin would post every custom
   * event outside the proxied path, where nothing serves it. Umami's own
   * pageviews would keep working, so the dashboard would look healthy while
   * every custom event 404'd.
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
