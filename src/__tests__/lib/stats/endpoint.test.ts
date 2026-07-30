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

  it('reads the origin and website id back off the injected tag', () => {
    injectScript({
      src: 'https://umami-coral-xi.vercel.app/script.js',
      'data-website-id': WEBSITE_ID,
    });

    expect(resolveUmamiTarget()).toEqual({
      origin: 'https://umami-coral-xi.vercel.app',
      websiteId: WEBSITE_ID,
    });
  });

  it('returns null when the tag carries no src', () => {
    injectScript({ 'data-website-id': WEBSITE_ID });

    expect(resolveUmamiTarget()).toBeNull();
  });

  it('resolves a relative src against the document instead of throwing', () => {
    // The previous inline implementation used `new URL(src)`, which throws here
    // and was swallowed by a bare catch.
    injectScript({ src: '/script.js', 'data-website-id': WEBSITE_ID });

    expect(resolveUmamiTarget()?.origin).toBe(window.location.origin);
  });
});
