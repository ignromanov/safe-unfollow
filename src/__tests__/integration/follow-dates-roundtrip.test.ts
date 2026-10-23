import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import FOLLOWERS_HTML from '../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../fixtures/instagram-html/following.html?raw';
import FOLLOWING_JSON from '../fixtures/instagram-html/following.json?raw';
import { buildAccountBadgeIndex } from '@/core/badges';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import type { AccountBadges } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

/**
 * GH#285: the dates the real parsers emit reach the row.
 *
 * Storage is proved with hand-made `BadgeMap`s in `indexeddb-service.test.ts`.
 * This file runs parser -> `buildAccountBadgeIndex` -> IndexedDB -> row, so a
 * parser emitting milliseconds (dropped by the Uint32 guard) or a zero would
 * surface here as a missing date.
 *
 * A Blob cast, not a File: `vitest/file-mock.ts` replaces `global.File` with a
 * string-backed stub (same shim as `instagram-html-format.test.ts`).
 */
const BASE = 'connections/followers_and_following';
const FORMATS = ['json', 'html'] as const;
type Format = (typeof FORMATS)[number];

// Same construction as `instagram-dates-fitted-verdict.test.ts`
// (FOLLOWING_UNFITTABLE / FOLLOWERS_UNFITTABLE): every `Aug` token swapped for
// one no candidate month table explains, so the fit fails without emptying the file.
const unfit = (html: string) => html.split('Aug ').join('Zzq ');

async function buildExport(format: Format, opts: { unreadableMonths?: boolean } = {}) {
  const zip = new JSZip();
  if (format === 'json') {
    zip.file(`${BASE}/following.json`, FOLLOWING_JSON);
    zip.file(`${BASE}/followers_1.json`, FOLLOWERS_JSON);
  } else {
    zip.file(
      `${BASE}/following.html`,
      opts.unreadableMonths ? unfit(FOLLOWING_HTML) : FOLLOWING_HTML
    );
    zip.file(
      `${BASE}/followers_1.html`,
      opts.unreadableMonths ? unfit(FOLLOWERS_HTML) : FOLLOWERS_HTML
    );
  }
  return (await zip.generateAsync({ type: 'blob' })) as File;
}

async function storeAs(hash: string, accounts: AccountBadges[]): Promise<void> {
  await indexedDBService.saveFileMetadata({
    fileHash: hash,
    fileName: 'x.zip',
    fileSize: 1,
    uploadDate: new Date(),
    accountCount: accounts.length,
    lastAccessed: Date.now(),
    version: 2,
  });
  await indexedDBService.storeAllAccounts(hash, accounts);
}

const HASHES = [...FORMATS.map(f => `roundtrip-${f}`), 'roundtrip-undated'];

describe('parsed follow dates reach the row (GH#285)', () => {
  beforeEach(async () => {
    indexedDBService.clearCaches();
    await Promise.all(HASHES.map(h => indexedDBService.clearFile(h)));
  });

  it.each(FORMATS)('every parsed follow date reaches its row (%s export)', async format => {
    const result = await parseInstagramZipFile(await buildExport(format));
    const accounts = buildAccountBadgeIndex(result.data);
    await storeAs(`roundtrip-${format}`, accounts);

    const rows = await indexedDBService.getAccountsByRange(
      `roundtrip-${format}`,
      0,
      accounts.length
    );
    // The parser lowercases every username (instagram-utils.ts:30), in the member
    // sets and in the timestamp maps alike, so rows and parsed keys compare directly.
    const badges = [
      ['following', result.data.following, result.data.followingTimestamps],
      ['followers', result.data.followers, result.data.followersTimestamps],
    ] as const;
    for (const [badge, members, timestamps] of badges) {
      const dated = rows.filter(r => typeof r.badges[badge] === 'number');
      // the fixture has dates for each badge, so neither loop can pass vacuously
      expect(dated.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.badges[badge] ?? null).toEqual(
          members.has(row.username) ? timestamps.get(row.username) || true : null
        );
      }
    }
  });

  it('an HTML export with no readable dates stores none, and is still marked datesStored', async () => {
    const result = await parseInstagramZipFile(
      await buildExport('html', { unreadableMonths: true })
    );
    expect(result.datesFitted).toBe(false);
    const accounts = buildAccountBadgeIndex(result.data);
    await storeAs('roundtrip-undated', accounts);

    const rows = await indexedDBService.getAccountsByRange('roundtrip-undated', 0, accounts.length);
    expect(rows.some(r => typeof r.badges.following === 'number')).toBe(false);
    expect(rows.some(r => r.badges.following === true)).toBe(true);
    expect((await indexedDBService.getFileMetadata('roundtrip-undated'))?.datesStored).toBe(true);
  });
});
