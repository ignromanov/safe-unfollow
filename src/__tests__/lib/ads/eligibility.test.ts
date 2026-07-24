import { describe, expect, it } from 'vitest';

import { isSampleRoute } from '@/lib/ads/eligibility';

describe('ads/eligibility', () => {
  describe('isSampleRoute', () => {
    it('detects the /sample route and language-prefixed variants', () => {
      window.history.pushState({}, '', '/sample');
      expect(isSampleRoute()).toBe(true);

      window.history.pushState({}, '', '/es/sample');
      expect(isSampleRoute()).toBe(true);
    });

    it('is false on non-sample routes', () => {
      window.history.pushState({}, '', '/results');
      expect(isSampleRoute()).toBe(false);
    });
  });
});
