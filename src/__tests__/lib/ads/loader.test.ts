import { beforeEach, describe, expect, it } from 'vitest';

import { pushAdSlot } from '@/lib/ads/loader';

describe('ads/loader', () => {
  beforeEach(() => {
    delete (window as { adsbygoogle?: unknown[] }).adsbygoogle;
  });

  it('initializes the adsbygoogle queue and pushes a fill request', () => {
    expect(() => pushAdSlot()).not.toThrow();
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it('appends to an existing adsbygoogle queue', () => {
    window.adsbygoogle = [{}];
    pushAdSlot();
    expect(window.adsbygoogle).toHaveLength(2);
  });
});
