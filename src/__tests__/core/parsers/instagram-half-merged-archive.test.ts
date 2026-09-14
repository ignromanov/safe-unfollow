import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { analyzeZipStructure } from '@/core/parsers/instagram-zip-analysis';
import FOLLOWERS_HTML from '../../fixtures/instagram-html/followers_1.html?raw';

/**
 * GH#160 step 2 — the union itself, and the instrument that can see it.
 *
 * Step 1 (#167) shipped `mixedRelationshipFormats`, and read on 2026-09-14 it
 * returned 0 true in 3 767 observations. That zero clears a narrower question
 * than this issue asks: the predicate is `relationshipFormats.size > 1`, a
 * FORMAT test, while the union is a BASE-PATH one. `keepShard` keys on
 * `relationshipFileBase(f.name)`, which strips the extension and keeps the
 * path, so two entries at two bases are two keys whatever their format — and a
 * half-merged archive whose bases share one format unions while the flag reads
 * false.
 *
 * `duplicateRelationshipShards` is the predicate that matches the mechanism:
 * one logical shard supplied by more than one directory. Twins inside a single
 * base are not duplicates — they already collapse to one key, which is the
 * same-directory union `#152` fixed.
 */

const CONNECTIONS = 'connections/followers_and_following';
const LEGACY = 'followers_and_following';

const followersJson = (username: string) =>
  JSON.stringify([
    {
      title: '',
      media_list_data: [],
      string_list_data: [
        { href: `https://www.instagram.com/${username}`, value: username, timestamp: 1785625582 },
      ],
    },
  ]);

describe('analyzeZipStructure reports a shard supplied by more than one base', () => {
  it('is true when one shard name exists under both bases in the same format', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      `${LEGACY}/followers_1.json`,
    ]);

    expect(analysis.duplicateRelationshipShards).toBe(true);
    // The older instrument is blind to this archive, which is why this one exists.
    expect(analysis.mixedRelationshipFormats).toBe(false);
  });

  it('is true when the two bases carry the same shard in different formats', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/followers_1.json`,
      `${LEGACY}/followers_1.html`,
    ]);

    expect(analysis.duplicateRelationshipShards).toBe(true);
  });

  it('is false for a clean single-base export', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      `${CONNECTIONS}/followers_2.json`,
    ]);

    expect(analysis.duplicateRelationshipShards).toBe(false);
  });

  it('is false when a second base exists but carries no relationship file', () => {
    // Two base directories are not the condition. The union needs the same
    // shard twice; a legacy folder holding only, say, a requests file unions
    // nothing, and reporting it would inflate the rate with archives that parse
    // correctly.
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/following.json`,
      `${CONNECTIONS}/followers_1.json`,
      `${LEGACY}/recent_follow_requests.json`,
    ]);

    expect(analysis.duplicateRelationshipShards).toBe(false);
  });

  it('is false for the twin pair inside one base, which already collapses', () => {
    const analysis = analyzeZipStructure([
      `${CONNECTIONS}/followers_1.json`,
      `${CONNECTIONS}/followers_1.html`,
    ]);

    expect(analysis.duplicateRelationshipShards).toBe(false);
    expect(analysis.mixedRelationshipFormats).toBe(true);
  });
});

let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/parsers/zip-archive')>()),
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

describe('parseFollowersFromZip reads one shard per name, whatever base it came from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipInstance = new MockZipArchive();
  });

  it('does not union two bases carrying the same shard in the same format', async () => {
    mockZipInstance._addFile(
      `${CONNECTIONS}/following.json`,
      vi.fn().mockResolvedValue('{"relationships_following":[]}')
    );
    mockZipInstance._addFile(
      `${CONNECTIONS}/followers_1.json`,
      vi.fn().mockResolvedValue(followersJson('alice'))
    );
    mockZipInstance._addFile(
      `${LEGACY}/followers_1.json`,
      vi.fn().mockResolvedValue(followersJson('bob'))
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    // `connections/` is globbed first and wins, which is also the base
    // `following` is read from — so both required files come from one export.
    expect([...result.data.followers]).toEqual(['alice']);
    expect(result.discovery.duplicateRelationshipShards).toBe(true);
  });

  it('prefers the JSON twin when the duplicate shards differ in format', async () => {
    mockZipInstance._addFile(
      `${CONNECTIONS}/following.json`,
      vi.fn().mockResolvedValue('{"relationships_following":[]}')
    );
    mockZipInstance._addFile(
      `${LEGACY}/followers_1.json`,
      vi.fn().mockResolvedValue(followersJson('alice'))
    );
    mockZipInstance._addFile(
      `${CONNECTIONS}/followers_1.html`,
      vi.fn().mockResolvedValue(FOLLOWERS_HTML)
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    // The rule the comment at instagram-followers.ts already states: JSON
    // outranks HTML however the two were found. Base order decides only among
    // equals. Real fixture bytes on the HTML side, so a twin that was read
    // shows up as 25 extra accounts rather than as nothing.
    expect([...result.data.followers]).toEqual(['alice']);
  });

  it('is omitted when the archive could never be analysed', async () => {
    // Same precedent as `datesFitted` and `mixedRelationshipFormats`: an
    // unopenable ZIP was not measured and found clean, and `false` here would
    // be a fabricated measurement in the denominator of a rate.
    const { openZipArchive } = await import('@/core/parsers/zip-archive');
    vi.mocked(openZipArchive).mockRejectedValueOnce(new Error('corrupt central directory'));

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.discovery.duplicateRelationshipShards).toBeUndefined();
  });
});
