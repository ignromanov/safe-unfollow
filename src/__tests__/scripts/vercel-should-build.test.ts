import { describe, expect, it } from 'vitest';

import { shouldSkipBuild } from '../../../scripts/vercel-should-build.mjs';

/**
 * A wrong skip serves stale production; a wrong build costs one build. Every case
 * below that is ambiguous must therefore resolve to "build".
 */
describe('shouldSkipBuild', () => {
  it('builds when the file list is empty, because an empty diff is not evidence', () => {
    // VERCEL_GIT_PREVIOUS_SHA is absent on a project's first deployment after the
    // Ignored Build Step is configured, and `git diff` can fail. Both arrive here as [].
    expect(shouldSkipBuild([])).toBe(false);
  });

  it('skips a workflow-only change', () => {
    expect(shouldSkipBuild(['.github/workflows/code-quality.yml'])).toBe(true);
  });

  it('skips a root README-only change', () => {
    expect(shouldSkipBuild(['README.md'])).toBe(true);
  });

  it('builds a docs/ change, because Jekyll renders docs/ into dist/docs', () => {
    expect(shouldSkipBuild(['docs/privacy.md'])).toBe(false);
  });

  it('builds a source change', () => {
    expect(shouldSkipBuild(['src/App.tsx'])).toBe(false);
  });

  it('builds when a skippable file and a source file change together', () => {
    // The failure mode this catches: `every` over an allowlist is correct, `some` is not.
    expect(shouldSkipBuild(['.github/workflows/ci.yml', 'src/App.tsx'])).toBe(false);
  });

  it('builds a config change at the root that is not markdown', () => {
    // vercel.json, package.json and vite.config.ts all reach dist/. Only root *.md is
    // skippable, and the regex must not widen to "any root file".
    expect(shouldSkipBuild(['vercel.json'])).toBe(false);
    expect(shouldSkipBuild(['package.json'])).toBe(false);
  });
});
