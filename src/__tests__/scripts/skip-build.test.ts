import { describe, expect, it } from 'vitest';

import { shouldSkipBuild } from '../../../scripts/skip-build.mjs';

/**
 * A wrong skip leaves a branch without a preview (or, on main, production stale); a wrong
 * build costs one build. Every ambiguous case must therefore resolve to "build".
 */
describe('shouldSkipBuild', () => {
  it('skips dependabot branches', () => {
    expect(shouldSkipBuild('dependabot/npm_and_yarn/vite-7.2.0')).toBe(true);
    expect(shouldSkipBuild('dependabot/github_actions/actions/checkout-7')).toBe(true);
  });

  it('builds main', () => {
    expect(shouldSkipBuild('main')).toBe(false);
  });

  it('builds a feature branch that merely mentions dependabot', () => {
    expect(shouldSkipBuild('fix/dependabot-config')).toBe(false);
  });

  it('builds when no branch is known, as in a local run', () => {
    expect(shouldSkipBuild(undefined)).toBe(false);
    expect(shouldSkipBuild('')).toBe(false);
  });
});
