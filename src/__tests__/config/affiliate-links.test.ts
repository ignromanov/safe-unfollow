import { describe, it, expect } from 'vitest';

import { AFFILIATE_LINKS } from '@/config/affiliate-links';

describe('AFFILIATE_LINKS', () => {
  it('holds a usable https URL for every program', () => {
    // Guards against a blanked or malformed link silently shipping: an empty
    // string is the documented "hide this placement" switch, so it must only
    // ever appear deliberately, never as a copy-paste slip.
    for (const [id, url] of Object.entries(AFFILIATE_LINKS)) {
      expect(url, `${id} must be a non-empty https URL`).toMatch(/^https:\/\/\S+$/);
    }
  });
});
