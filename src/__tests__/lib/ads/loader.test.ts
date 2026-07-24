import { beforeEach, describe, expect, it } from 'vitest';

import { pushAdSlot } from '@/lib/ads/loader';

const CLIENT = 'ca-pub-5976295812261948';

describe('ads/loader', () => {
  beforeEach(() => {
    delete (window as { adsbygoogle?: unknown[] }).adsbygoogle;
    document.getElementById('adsbygoogle-js')?.remove();
  });

  it('initializes the adsbygoogle queue and pushes a fill request', () => {
    expect(() => pushAdSlot(CLIENT)).not.toThrow();
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it('appends to an existing adsbygoogle queue', () => {
    window.adsbygoogle = [{}];
    pushAdSlot(CLIENT);
    expect(window.adsbygoogle).toHaveLength(2);
  });

  it('injects the adsbygoogle script exactly once with the client id', () => {
    pushAdSlot(CLIENT);
    pushAdSlot(CLIENT);

    const scripts = document.querySelectorAll('#adsbygoogle-js');
    expect(scripts).toHaveLength(1);

    const script = scripts[0] as HTMLScriptElement;
    expect(script.src).toContain('adsbygoogle.js');
    expect(script.src).toContain(CLIENT);
  });
});
