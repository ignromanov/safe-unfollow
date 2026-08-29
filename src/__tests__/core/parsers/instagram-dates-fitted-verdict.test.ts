import { beforeEach, describe, expect, it, vi } from 'vitest';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../../fixtures/instagram-html/following.html?raw';
import { parseInstagramZipFile } from '@/core/parsers/instagram';

/**
 * GH#156, the blocked half, threaded all the way to `ParseResult`.
 *
 * `parseInstagramZipFile` is the layer `detectRelationshipSkew` runs inside,
 * so it is where `truncatedRelationshipFile` (the verdict) and `datesFitted`
 * (why an `insufficient-data` verdict might be locale-driven rather than a
 * small account) have to arrive on the same result. Per-file behaviour is
 * `instagram-html-dates-fitted.test.ts`'s job; this file is only the
 * aggregation across the two required files a real parse actually reads.
 *
 * Same mocking shape as `instagram-transcoder-exception.test.ts`: a
 * `MockZipArchive` behind a mocked `openZipArchive`, real fixture bytes as the
 * file contents.
 */
let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/parsers/zip-archive')>()),
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

const BASE = 'connections/followers_and_following';

// Every `Aug` token in `following.html` swapped for one no candidate month
// table explains — the same construction `instagram-html-dates-fitted.test.ts`
// uses to fail a fit without emptying the file.
const FOLLOWING_UNFITTABLE = FOLLOWING_HTML.split('Aug ').join('Zzq ');
const FOLLOWERS_UNFITTABLE = FOLLOWERS_HTML.split('Aug ').join('Zzq ');

describe('parseInstagramZipFile aggregates datesFitted across the required files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipInstance = new MockZipArchive();
  });

  it('is true when both required HTML files date cleanly', async () => {
    mockZipInstance._addFile(`${BASE}/following.html`, vi.fn().mockResolvedValue(FOLLOWING_HTML));
    mockZipInstance._addFile(`${BASE}/followers_1.html`, vi.fn().mockResolvedValue(FOLLOWERS_HTML));

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.datesFitted).toBe(true);
  });

  it('is false when only following.html fails to fit, not merely undefined', async () => {
    mockZipInstance._addFile(
      `${BASE}/following.html`,
      vi.fn().mockResolvedValue(FOLLOWING_UNFITTABLE)
    );
    mockZipInstance._addFile(`${BASE}/followers_1.html`, vi.fn().mockResolvedValue(FOLLOWERS_HTML));

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.datesFitted).toBe(false);
  });

  it('is false when only a followers shard fails to fit', async () => {
    mockZipInstance._addFile(`${BASE}/following.html`, vi.fn().mockResolvedValue(FOLLOWING_HTML));
    mockZipInstance._addFile(
      `${BASE}/followers_1.html`,
      vi.fn().mockResolvedValue(FOLLOWERS_UNFITTABLE)
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.datesFitted).toBe(false);
  });

  it('is omitted for a JSON-only export — the question never arose', async () => {
    // The precedent this follows: `fileUploadSuccess` omits `format` on its
    // cache-hit path rather than sending a fabricated value, and `datesFitted`
    // does the same for a parse that read no HTML relationship file at all.
    mockZipInstance._addFile(
      `${BASE}/following.json`,
      vi.fn().mockResolvedValue('{"relationships_following":[]}')
    );
    mockZipInstance._addFile(`${BASE}/followers_1.json`, vi.fn().mockResolvedValue(FOLLOWERS_JSON));

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.datesFitted).toBeUndefined();
  });
});
