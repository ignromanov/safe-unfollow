import { describe, it, expect } from 'vitest';

import { pwaConfig } from '../../../vite/pwa-config';

describe('PWA navigation caching', () => {
  it('races the network against the cache instead of waiting indefinitely', () => {
    // Workbox only constructs the timeout race when networkTimeoutSeconds is truthy
    // (NetworkFirst.ts:70, 90-133). Unset, a NetworkFirst navigation waits out the
    // browser's own mobile timeout before touching the cache it already has.
    const routes = pwaConfig.workbox?.runtimeCaching ?? [];
    const pages = routes.find(r => r.options?.cacheName === 'pages-cache');
    expect(pages, 'no pages-cache route found').toBeDefined();
    expect(pages?.handler).toBe('NetworkFirst');
    expect(pages?.options?.networkTimeoutSeconds).toBe(3);
  });
});
