import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import FOLLOWERS_HTML from '../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../fixtures/instagram-html/following.html?raw';
import FOLLOWING_JSON from '../fixtures/instagram-html/following.json?raw';
import { buildAccountBadgeIndex } from '@/core/badges';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import type { AccountBadges, DateSources, DateZone } from '@/core/types';
import { createFollowDateFormatter } from '@/lib/follow-dates';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { SAMPLE_DATE_SOURCES } from '@/lib/sample-data';

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

// Per-shard formats, for archives that mix them (Instagram does not promise one format per export).
async function buildMixedExport(following: Format, followers: Format[]) {
  const zip = new JSZip();
  zip.file(
    `${BASE}/following.${following}`,
    following === 'json' ? FOLLOWING_JSON : FOLLOWING_HTML
  );
  followers.forEach((fmt, i) => {
    zip.file(`${BASE}/followers_${i + 1}.${fmt}`, fmt === 'json' ? FOLLOWERS_JSON : FOLLOWERS_HTML);
  });
  return (await zip.generateAsync({ type: 'blob' })) as File;
}

async function storeAs(
  hash: string,
  accounts: AccountBadges[],
  dateSources: DateSources
): Promise<void> {
  await indexedDBService.saveFileMetadata({
    fileHash: hash,
    fileName: 'x.zip',
    fileSize: 1,
    uploadDate: new Date(),
    accountCount: accounts.length,
    lastAccessed: Date.now(),
    version: 2,
  });
  await indexedDBService.storeAllAccounts(hash, accounts, dateSources);
}

const ZONES = ['UTC', 'America/Asuncion', 'Asia/Jakarta'] as const;
// Hand-computed from the fixtures (user001: JSON 1786415560, HTML printed "Aug 10, 2026 6:32 pm"),
// not produced by the code under test. An HTML date is a printed wall-clock read as UTC, so it
// never moves; a JSON date is an instant, so it follows the viewer.
const EXPECTED = {
  html: { UTC: 'Aug 10, 2026', 'America/Asuncion': 'Aug 10, 2026', 'Asia/Jakarta': 'Aug 10, 2026' },
  json: { UTC: 'Aug 11, 2026', 'America/Asuncion': 'Aug 10, 2026', 'Asia/Jakarta': 'Aug 11, 2026' },
} as const;

const HASHES = [
  ...FORMATS.flatMap(f => [`roundtrip-${f}`, `day-${f}`]),
  'roundtrip-undated',
  'mixed-zones',
  'mixed-shards',
];

describe('parsed follow dates reach the row (GH#285)', () => {
  beforeEach(async () => {
    indexedDBService.clearCaches();
    await Promise.all(HASHES.map(h => indexedDBService.clearFile(h)));
  });

  it.each(FORMATS)('every parsed follow date reaches its row (%s export)', async format => {
    const result = await parseInstagramZipFile(await buildExport(format));
    const accounts = buildAccountBadgeIndex(result.data);
    await storeAs(`roundtrip-${format}`, accounts, result.dateSources);

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
    await storeAs('roundtrip-undated', accounts, result.dateSources);

    const rows = await indexedDBService.getAccountsByRange('roundtrip-undated', 0, accounts.length);
    expect(rows.some(r => typeof r.badges.following === 'number')).toBe(false);
    expect(rows.some(r => r.badges.following === true)).toBe(true);
    expect((await indexedDBService.getFileMetadata('roundtrip-undated'))?.datesStored).toBe(true);
  });
});

describe.each(FORMATS)('the shown day (GH#285 PR-2) - %s', format => {
  beforeEach(async () => {
    indexedDBService.clearCaches();
    await indexedDBService.clearFile(`day-${format}`);
  });

  it.each(ZONES)('user001 following, viewer in %s', async viewer => {
    const parsed = await parseInstagramZipFile(await buildExport(format));
    const unified = buildAccountBadgeIndex(parsed.data);
    await storeAs(`day-${format}`, unified, parsed.dateSources);
    const zones = (await indexedDBService.getFileMetadata(`day-${format}`))!.dateZones!;
    const i = unified.findIndex(a => a.username === 'user001');
    expect(i).toBeGreaterThanOrEqual(0);
    const [row] = await indexedDBService.getAccountsByRange(`day-${format}`, i, i + 1);
    const seconds = row!.badges.following as number;
    expect(createFollowDateFormatter('en', viewer)(seconds, zones.following!)).toBe(
      EXPECTED[format][viewer]
    );
  });
});

describe('the shown day across mixed archives (GH#285 PR-2)', () => {
  beforeEach(async () => {
    indexedDBService.clearCaches();
    await Promise.all(['mixed-zones', 'mixed-shards'].map(h => indexedDBService.clearFile(h)));
  });

  it('a mixed archive stores each badge in its own zone', async () => {
    const parsed = await parseInstagramZipFile(await buildMixedExport('json', ['html']));
    await storeAs('mixed-zones', buildAccountBadgeIndex(parsed.data), parsed.dateSources);
    const zones = (await indexedDBService.getFileMetadata('mixed-zones'))!.dateZones;
    expect(zones).toEqual({ following: 'local', followers: 'utc' });
  });

  it('followers shards of both formats store no followers dates, and following still has its line', async () => {
    const parsed = await parseInstagramZipFile(await buildMixedExport('json', ['json', 'html']));
    const unified = buildAccountBadgeIndex(parsed.data);
    await storeAs('mixed-shards', unified, parsed.dateSources);
    const zones = (await indexedDBService.getFileMetadata('mixed-shards'))!.dateZones!;
    expect(zones.followers).toBeUndefined();
    expect(zones.following).toBe('local');
    const rows = await indexedDBService.getAccountsByRange('mixed-shards', 0, unified.length);
    const i = unified.findIndex(a => a.username === 'user001');
    expect(typeof rows[i]!.badges.following).toBe('number');
    // user001 is not a follower in the fixture, so the followers claim is made over all rows:
    // members exist, and none carries a date.
    expect(rows.some(r => r.badges.followers === true)).toBe(true);
    expect(rows.some(r => typeof r.badges.followers === 'number')).toBe(false);
  });
});

it('the sample shows its synthetic midnight-UTC date on the same day everywhere', () => {
  // julia_fitness following 1704067200 = 2024-01-01T00:00Z
  for (const viewer of ZONES) {
    expect(
      createFollowDateFormatter('en', viewer)(1704067200, SAMPLE_DATE_SOURCES.following as DateZone)
    ).toBe('Jan 1, 2024');
  }
});
