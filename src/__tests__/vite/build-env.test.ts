import { describe, expect, it } from 'vitest';

import { buildVersion, scrubPreviewEnv } from '../../../vite/build-env';

describe('buildVersion', () => {
  it('is the short commit sha on Workers Builds', () => {
    expect(buildVersion({ WORKERS_CI_COMMIT_SHA: 'abcdef0123456789' }, '1.6.0')).toBe('abcdef0');
  });

  it('is the short commit sha on Vercel until the cut-over', () => {
    expect(buildVersion({ VERCEL_GIT_COMMIT_SHA: '1234567890abcdef' }, '1.6.0')).toBe('1234567');
  });

  it("is package.json's version anywhere else", () => {
    expect(buildVersion({}, '1.6.0')).toBe('1.6.0');
  });
});

describe('scrubPreviewEnv', () => {
  const ID = '00000000-0000-0000-0000-000000000000';

  it('keeps the analytics id on the production branch', () => {
    const env = { WORKERS_CI_BRANCH: 'main', VITE_UMAMI_WEBSITE_ID: ID };
    scrubPreviewEnv(env);
    expect(env.VITE_UMAMI_WEBSITE_ID).toBe(ID);
  });

  it('drops it on any other Workers Builds branch, so previews never write live data', () => {
    const env: Record<string, string | undefined> = {
      WORKERS_CI_BRANCH: 'feat/x',
      VITE_UMAMI_WEBSITE_ID: ID,
    };
    scrubPreviewEnv(env);
    expect(env.VITE_UMAMI_WEBSITE_ID).toBeUndefined();
  });

  it('leaves a local build alone', () => {
    const env = { VITE_UMAMI_WEBSITE_ID: ID };
    scrubPreviewEnv(env);
    expect(env.VITE_UMAMI_WEBSITE_ID).toBe(ID);
  });
});
