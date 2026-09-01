import { beforeEach, describe, expect, it, vi } from 'vitest';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../../fixtures/instagram-html/followers_1.json?raw';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { analyzeZipStructure } from '@/core/parsers/instagram-zip-analysis';

/**
 * GH#160 step 1 — observability only, no behaviour change.
 *
 * `analyzeZipStructure` already builds the set of relationship formats actually
 * present and then collapses it through `pickFormat`, so a half-merged archive
 * (Instagram's older `followers_and_following/` alongside the current
 * `connections/followers_and_following/`, in different formats) reports plain
 * `json` and is indistinguishable in the dashboard from a clean export. The
 * fact is computed and discarded; these tests are what stop it being discarded.
 *
 * Nothing here asserts on account counts. Whether the parser should keep
 * reading both base paths is step 2 of the issue, and the whole point of the
 * ordering is that this change must not move a single byte of parse output —
 * so `format` is pinned in every case below.
 */

const CONNECTIONS = 'connections/followers_and_following';
const LEGACY = 'followers_and_following';

describe('analyzeZipStructure reports whether the archive mixes relationship formats', () => {
  it('is false for a clean JSON export', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
    ]);

    expect(analysis.mixedRelationshipFormats).toBe(false);
    expect(analysis.format).toBe('json');
  });

  it('is false for a clean HTML export', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.html`,
      `${CONNECTIONS}/followers_1.html`,
    ]);

    expect(analysis.mixedRelationshipFormats).toBe(false);
    expect(analysis.format).toBe('html');
  });

  it('is true when the two base paths carry different formats', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      `${LEGACY}/following.html`,
      `${LEGACY}/followers_1.html`,
    ]);

    expect(analysis.mixedRelationshipFormats).toBe(true);
  });

  it('leaves the reported format untouched on a mixed archive', () => {
    // The pin. `pickFormat` prefers JSON for a mixed set so the archive degrades
    // to the path this tool has always read; step 1 observes that choice and
    // must not alter it.
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      `${LEGACY}/followers_1.html`,
    ]);

    expect(analysis.format).toBe('json');
    expect(analysis.mixedRelationshipFormats).toBe(true);
  });

  it('is false when an unrelated .html sits beside a JSON export', () => {
    // The archive-wide extension counts are not the source. `RELATIONSHIP_FILE`
    // is, which is why a `.png` or a saved page cannot vote — the same reason
    // `format` stopped being read off them.
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      'personal_information/index.html',
    ]);

    expect(analysis.mixedRelationshipFormats).toBe(false);
  });
});

/**
 * Same mocking shape as `instagram-dates-fitted-verdict.test.ts`: a
 * `MockZipArchive` behind a mocked `openZipArchive`, real fixture bytes.
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

describe('parseInstagramZipFile carries the mixed-format fact to discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipInstance = new MockZipArchive();
  });

  it('is false for a clean JSON export', async () => {
    mockZipInstance._addFile(
      `${CONNECTIONS}/following.json`,
      vi.fn().mockResolvedValue('{"relationships_following":[]}')
    );
    mockZipInstance._addFile(
      `${CONNECTIONS}/followers_1.json`,
      vi.fn().mockResolvedValue(FOLLOWERS_JSON)
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.discovery.mixedRelationshipFormats).toBe(false);
  });

  it('is true for a half-merged archive, while format still reads json', async () => {
    mockZipInstance._addFile(
      `${CONNECTIONS}/following.json`,
      vi.fn().mockResolvedValue('{"relationships_following":[]}')
    );
    mockZipInstance._addFile(
      `${CONNECTIONS}/followers_1.json`,
      vi.fn().mockResolvedValue(FOLLOWERS_JSON)
    );
    mockZipInstance._addFile(
      `${LEGACY}/followers_1.html`,
      vi.fn().mockResolvedValue(FOLLOWERS_HTML)
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.discovery.mixedRelationshipFormats).toBe(true);
    expect(result.discovery.format).toBe('json');
  });

  it('is omitted when the archive could never be analysed', async () => {
    // The precedent is `datesFitted`, which is undefined rather than false for a
    // parse that never asked the question. An unopenable ZIP was not measured
    // and found clean; `false` here would be a fabricated measurement.
    //
    // This is the one test here that would pass against today's code, because
    // the field is absent from every result. What it pins is the fork taken
    // implementing it: declare `mixedRelationshipFormats` as a plain `boolean`
    // and the two pre-analysis exits must invent a value, and this fails.
    const { openZipArchive } = await import('@/core/parsers/zip-archive');
    vi.mocked(openZipArchive).mockRejectedValueOnce(new Error('corrupt central directory'));

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.discovery.mixedRelationshipFormats).toBeUndefined();
  });
});
