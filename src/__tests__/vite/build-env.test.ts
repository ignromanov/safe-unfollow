import { describe, expect, it } from 'vitest';

import {
  buildVersion,
  citationReleaseDate,
  scrubPreviewEnv,
  sourceUrl,
} from '../../../vite/build-env';

describe('buildVersion', () => {
  it('is the short commit sha on Workers Builds', () => {
    expect(buildVersion({ WORKERS_CI_COMMIT_SHA: 'abcdef0123456789' }, '1.6.0')).toBe('abcdef0');
  });

  it("is package.json's version anywhere else", () => {
    expect(buildVersion({}, '1.6.0')).toBe('1.6.0');
  });
});

// AGPL-3.0 §13: a network user is offered the source of the version they are using,
// so the footer links the exact commit that was built, not the moving default branch.
describe('sourceUrl', () => {
  it('points at the built commit on Workers Builds', () => {
    expect(sourceUrl({ WORKERS_CI_COMMIT_SHA: 'abcdef0123456789' })).toBe(
      'https://github.com/ignromanov/safe-unfollow/tree/abcdef0'
    );
  });

  it('falls back to the repository when no commit is known', () => {
    expect(sourceUrl({})).toBe('https://github.com/ignromanov/safe-unfollow');
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

describe('citationReleaseDate', () => {
  it('reads a quoted or bare date-released', () => {
    expect(citationReleaseDate("version: 1.7.0\ndate-released: '2026-11-09'\n")).toBe('2026-11-09');
    expect(citationReleaseDate('date-released: 2026-11-09\n')).toBe('2026-11-09');
  });

  it('throws rather than publishing an empty dateModified', () => {
    expect(() => citationReleaseDate('version: 1.7.0\n')).toThrow(/date-released/);
    expect(() => citationReleaseDate("date-released: 'soon'\n")).toThrow(/date-released/);
  });
});
