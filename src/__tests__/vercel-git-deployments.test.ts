import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 43% of deployments in the 2026-09-14 audit were dependabot dev-dependency bumps that
 * cannot change `dist/`, against a Deployment Storage limit with ~7 days of headroom.
 * The rule is one line of config and nothing else in the repository would notice it
 * being deleted, which is why it has a test.
 */
const ROOT = resolve(__dirname, '../..');

function deploymentEnabled(): Record<string, boolean> {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    git?: { deploymentEnabled?: Record<string, boolean> };
  };
  return config.git?.deploymentEnabled ?? {};
}

describe('vercel.json git.deploymentEnabled', () => {
  it('builds no previews for dependabot branches', () => {
    expect(deploymentEnabled()).toMatchObject({ 'dependabot/**': false });
  });

  it('enables no pattern, because one true pattern would re-admit dependabot', () => {
    // Vercel resolves overlapping branch patterns as "deploy if AT LEAST ONE matching
    // rule is true" (vercel.com/docs/project-configuration/git-configuration). So a
    // later `"*": true` defeats the rule above without editing it, and the diff that
    // does it looks like it is enabling something unrelated.
    const enabled = Object.entries(deploymentEnabled())
      .filter(([, on]) => on)
      .map(([pattern]) => pattern);

    expect(enabled).toEqual([]);
  });
});
