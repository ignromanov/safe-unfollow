import { afterEach, describe, expect, it } from 'vitest';

import { resolveUmamiTarget } from '@/lib/stats/endpoint';

const WEBSITE_ID = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';

function injectScript(attrs: Record<string, string>): HTMLScriptElement {
  const script = document.createElement('script');
  for (const [key, value] of Object.entries(attrs)) {
    script.setAttribute(key, value);
  }
  document.head.appendChild(script);
  return script;
}

describe('resolveUmamiTarget', () => {
  afterEach(() => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());
  });

  it('returns null when the analytics script was never injected', () => {
    expect(resolveUmamiTarget()).toBeNull();
  });

  it('reads the base url and website id back off the injected tag', () => {
    injectScript({
      src: 'https://umami-coral-xi.vercel.app/script.js',
      'data-website-id': WEBSITE_ID,
    });

    expect(resolveUmamiTarget()).toEqual({
      baseUrl: 'https://umami-coral-xi.vercel.app',
      websiteId: WEBSITE_ID,
    });
  });

  it('resolves the script directory, not the origin, when the two differ', () => {
    // ⛔ Production stopped exercising this on 2026-09-14. The `/v/` proxy was removed,
    // so the tag now sits at an origin root where directory and origin are the same
    // string — which is exactly the accident this distinction was written to survive.
    // Keep the nested fixture: it is the only thing left that can catch a substitution
    // of origin for dirname. Umami's own tracker derives its collect endpoint as
    // dirname(script.src), so ours must too; getting it wrong posts every custom event
    // where nothing serves it while Umami's pageviews keep working, so the dashboard
    // looks healthy and every custom event 404s.
    injectScript({ src: '/v/script.js', 'data-website-id': WEBSITE_ID });

    expect(resolveUmamiTarget()?.baseUrl).toBe(`${window.location.origin}/v`);
  });

  it('returns null when the tag carries no src', () => {
    injectScript({ 'data-website-id': WEBSITE_ID });

    expect(resolveUmamiTarget()).toBeNull();
  });

  it('resolves a relative src against the document instead of throwing', () => {
    // The previous inline implementation used `new URL(src)`, which throws here
    // and was swallowed by a bare catch.
    injectScript({ src: '/script.js', 'data-website-id': WEBSITE_ID });

    expect(resolveUmamiTarget()?.baseUrl).toBe(window.location.origin);
  });
});
