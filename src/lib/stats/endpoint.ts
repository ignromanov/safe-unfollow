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
  /** Origin of the Umami instance, e.g. `https://umami-coral-xi.vercel.app`. */
  origin: string;
  websiteId: string;
}

export function resolveUmamiTarget(): UmamiTarget | null {
  if (typeof document === 'undefined') return null;

  const scriptEl = document.querySelector('script[data-website-id]');
  const websiteId = scriptEl?.getAttribute('data-website-id');
  const src = scriptEl?.getAttribute('src');
  if (!websiteId || !src) return null;

  try {
    return { origin: new URL(src, window.location.href).origin, websiteId };
  } catch {
    return null;
  }
}
