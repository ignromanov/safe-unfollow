import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { VALID_ARRAY_OF_ONE, makeEntry } from '../../fixtures/instagram-format-drift';

/**
 * GH#157. An exception thrown *inside* `parseRelationshipFile` — not a
 * recognized-but-empty shape, an actual throw — used to be caught at severity
 * `'warning'` regardless of whether the file was required, so a required file
 * that threw was reported the same as one that was simply absent, and a
 * followers shard that threw vanished without marking the followers set
 * unreadable. `instagram-html.ts` documents the HTML transcoder as
 * never throwing by design (an assumption, not an enforced invariant, per the
 * issue) — so the exception is simulated here by mocking `parseRelationshipFile`
 * itself for `.html` entries, which exercises exactly the catch block GH#157 is
 * about without depending on `transcodeRelationshipHtml` ever actually
 * throwing.
 *
 * Same `MockZipArchive` + `openZipArchive` mock as `instagram.test.ts`; kept in
 * its own file because the `parseRelationshipFile` mock below is scoped to this
 * file only and must not leak into other parser tests.
 */

let mockZipInstance: any;
vi.mock('@/core/parsers/zip-archive', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/parsers/zip-archive')>()),
  openZipArchive: vi.fn().mockImplementation(() => Promise.resolve(mockZipInstance)),
}));

vi.mock('@/core/parsers/instagram-html', async importOriginal => {
  const actual = await importOriginal<typeof import('@/core/parsers/instagram-html')>();
  return {
    ...actual,
    // Every `.html` entry throws, whatever its text — good enough for these
    // tests, which only ever put a throwing file where the real transcoder
    // would have been invoked. `.json` entries pass through to the real
    // JSON.parse-based implementation unchanged.
    parseRelationshipFile: (name: string, text: string) => {
      if (name.toLowerCase().endsWith('.html')) {
        throw new Error('simulated transcoder failure');
      }
      return actual.parseRelationshipFile(name, text);
    },
  };
});

const { MockZipArchive } = vi.hoisted(() => {
  const { MockZipArchive } = require('../../__mocks__/zip-archive.cjs');
  return { MockZipArchive };
});

const BASE = 'connections/followers_and_following';

describe('a required file whose transcoder throws (GH#157)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipInstance = new MockZipArchive();
  });

  it('fails loudly instead of reporting following.json missing', async () => {
    mockZipInstance._addFile(
      `${BASE}/following.html`,
      vi.fn().mockResolvedValue('<html>irrelevant</html>')
    );
    // Followers present and valid, so a false hasMinimalData=true could not be
    // explained by "nothing parsed at all" — only by the unreadable-following
    // exit being skipped.
    mockZipInstance._addFile(
      `${BASE}/followers_1.json`,
      vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.hasMinimalData).toBe(false);
    const error = result.warnings.find(w => w.code === 'JSON_PARSE_ERROR');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('following.html');

    // Present but unreadable, not "we didn't find it" — the two must not
    // share an exit.
    expect(result.warnings.find(w => w.code === 'MISSING_FOLLOWING')).toBeUndefined();
    expect(result.discovery.files.find(f => f.name === 'following.json')?.found).toBe(true);
  });

  it('marks the followers set unreadable when one shard throws, even with a good sibling shard', async () => {
    mockZipInstance._addFile(
      `${BASE}/following.json`,
      vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
    );
    mockZipInstance._addFile(
      `${BASE}/followers_1.html`,
      vi.fn().mockResolvedValue('<html>irrelevant</html>')
    );
    mockZipInstance._addFile(
      `${BASE}/followers_2.json`,
      vi.fn().mockResolvedValue(JSON.stringify([makeEntry('validuser2')]))
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    // Before the fix: describeFollowersOutcome saw formatInvalidFiles=[],
    // unresolvedEntries=0 and resolvedCount=1 (from the good shard), so it
    // pushed no warning at all and `unreadable` (derived from that empty
    // outcome) stayed false — the thrown shard vanished silently and
    // notFollowingBack would have inflated by every follower it held.
    expect(result.hasMinimalData).toBe(false);
    const error = result.warnings.find(w => w.code === 'JSON_PARSE_ERROR');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('followers_1.html');

    // The good shard's data is not silently discarded, just not trusted as a
    // complete answer on its own — same contract as an unreadable record.
    expect(result.data.followers.has('validuser2')).toBe(true);
  });
});

describe('an optional file whose transcoder throws (GH#157 regression guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipInstance = new MockZipArchive();
  });

  it('stays a warning and does not fail the upload', async () => {
    mockZipInstance._addFile(
      `${BASE}/following.json`,
      vi.fn().mockResolvedValue(JSON.stringify(VALID_ARRAY_OF_ONE))
    );
    mockZipInstance._addFile(
      `${BASE}/followers_1.json`,
      vi.fn().mockResolvedValue(JSON.stringify([makeEntry('validuser2')]))
    );
    mockZipInstance._addFile(
      `${BASE}/close_friends.html`,
      vi.fn().mockResolvedValue('<html>irrelevant</html>')
    );

    const result = await parseInstagramZipFile(
      new File(['test'], 'test.zip', { type: 'application/zip' })
    );

    expect(result.hasMinimalData).toBe(true);
    const error = result.warnings.find(w => w.code === 'JSON_PARSE_ERROR');
    expect(error?.severity).toBe('warning');
    expect(error?.message).toContain('close_friends.html');
    expect(result.warnings.some(w => w.severity === 'error')).toBe(false);
  });
});
