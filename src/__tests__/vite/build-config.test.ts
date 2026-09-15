import { describe, expect, it } from 'vitest';

import { buildConfig } from '../../../vite/build-config';

/**
 * Sourcemaps measured 2.71x the size of the code they map and about 20% of a 19.2 MB
 * deployment, against a Deployment Storage limit with roughly seven days of headroom.
 * They also served publicly: /assets/app-*.js.map answered 200 with 1.9 MB.
 *
 * `'hidden'` would not do: it drops the sourceMappingURL comment and still emits and
 * deploys the file. Only `false` removes it.
 *
 * The companion assertion — that a real `dist/` carries no `.map` — deliberately lives in
 * `src/__tests__/build/no-sourcemaps-in-dist.test.ts` instead of here, because
 * `every-build-suite-is-gated.test.ts` only scans that directory. A dist-reading suite
 * parked outside it is gated by nothing but the author's memory.
 */
describe('buildConfig', () => {
  it('emits no sourcemaps', () => {
    expect(buildConfig.sourcemap).toBe(false);
  });
});
