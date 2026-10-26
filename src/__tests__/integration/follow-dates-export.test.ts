import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import FOLLOWERS_HTML from '../fixtures/instagram-html/followers_1.html?raw';
import FOLLOWERS_JSON from '../fixtures/instagram-html/followers_1.json?raw';
import FOLLOWING_HTML from '../fixtures/instagram-html/following.html?raw';
import FOLLOWING_JSON from '../fixtures/instagram-html/following.json?raw';
import { buildAccountBadgeIndex } from '@/core/badges';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import type { DateZone } from '@/core/types';
import { buildExportCsv } from '@/lib/export/csv';
import { toIsoDay } from '@/lib/export/dates';
import { FREE_EXPORT_ROWS } from '@/lib/export/free-tier';
import { buildExportHtml } from '@/lib/export/html';
import { buildExportJson } from '@/lib/export/json';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { makeReport, readBlobText as readReport } from '../utils/report-context-fixture';

/**
 * GH#285 PR-3: the date a reader sees on a row leaves in the file as the same day.
 *
 * Parser -> `buildAccountBadgeIndex` -> IndexedDB -> export, on the fixtures
 * `follow-dates-roundtrip.test.ts` uses. The builders are mocked nowhere here,
 * so the date zones are read from the real file record.
 */
const BASE = 'connections/followers_and_following';
const FORMATS = ['json', 'html'] as const;
type Format = (typeof FORMATS)[number];

async function buildArchive(format: Format) {
  const zip = new JSZip();
  zip.file(`${BASE}/following.${format}`, format === 'json' ? FOLLOWING_JSON : FOLLOWING_HTML);
  zip.file(`${BASE}/followers_1.${format}`, format === 'json' ? FOLLOWERS_JSON : FOLLOWERS_HTML);
  // A Blob cast, not a File: `vitest/file-mock.ts` stubs `global.File`.
  return (await zip.generateAsync({ type: 'blob' })) as File;
}

async function store(hash: string, format: Format): Promise<number> {
  const parsed = await parseInstagramZipFile(await buildArchive(format));
  const accounts = buildAccountBadgeIndex(parsed.data);
  await indexedDBService.saveFileMetadata({
    fileHash: hash,
    fileName: 'x.zip',
    fileSize: 1,
    uploadDate: new Date(),
    accountCount: accounts.length,
    lastAccessed: Date.now(),
    version: 2,
  });
  await indexedDBService.storeAllAccounts(hash, accounts, parsed.dateSources);
  return accounts.length;
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function csvRows(blob: Blob): Promise<Record<string, string>[]> {
  const [header, ...rows] = (await readBlobText(blob)).trim().split('\n');
  const columns = header!.split(',');
  return rows.map(row => {
    const cells = row.split(',');
    return Object.fromEntries(columns.map((column, i) => [column, cells[i]!]));
  });
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (cell: string | undefined) => ISO_DAY.test(cell ?? '');

const HASHES = FORMATS.flatMap(f => [`export-${f}`, `zoneless-${f}`, `free-${f}`]);

describe.each(FORMATS)('follow dates leave in the export (GH#285 PR-3) - %s', format => {
  beforeEach(async () => {
    indexedDBService.clearCaches();
    await Promise.all(HASHES.map(h => indexedDBService.clearFile(h)));
  });

  it('every CSV and JSON date is the day of the row the UI reads', async () => {
    const hash = `export-${format}`;
    const total = await store(hash, format);
    const zones = (await indexedDBService.getFileMetadata(hash))!.dateZones!;
    const rows = await indexedDBService.getAccountsByRange(hash, 0, total);
    const csv = await csvRows(await buildExportCsv(hash, null, total));
    const json = JSON.parse(await readBlobText(await buildExportJson(hash, null, total)));

    let dated = 0;
    rows.forEach((row, i) => {
      expect(csv[i]!.username).toBe(row.username);
      for (const badge of ['following', 'followers'] as const) {
        const seconds = row.badges[badge];
        const day =
          typeof seconds === 'number' ? toIsoDay(seconds, zones[badge] as DateZone) : undefined;
        expect(csv[i]![`${badge}Date`]).toBe(day ?? '');
        expect(json[i].dates[badge]).toBe(day);
        if (day) dated += 1;
      }
    });
    // the fixtures carry dates for both badges, so the loop cannot pass vacuously
    expect(dated).toBeGreaterThan(0);
  });

  // Hand-computed from the fixtures, not by the code under test: user001's HTML
  // row prints "Aug 10, 2026 6:32 pm" (a wall clock read as UTC, so it never
  // moves); its JSON epoch 1786415560 is 2026-08-11 00:32:40 UTC, which is the
  // 10th or the 11th depending on the viewer's zone.
  it('user001 following leaves on the day it was recorded', async () => {
    const hash = `export-${format}`;
    const total = await store(hash, format);
    const row = (await csvRows(await buildExportCsv(hash, null, total))).find(
      r => r.username === 'user001'
    );
    if (format === 'html') expect(row!.followingDate).toBe('2026-08-10');
    else expect(['2026-08-10', '2026-08-11']).toContain(row!.followingDate);
  });

  it('a file stored before date zones existed exports no dates and the same booleans', async () => {
    const hash = `zoneless-${format}`;
    const total = await store(hash, format);
    const before = await csvRows(await buildExportCsv(hash, null, total));
    const { dateZones, ...record } = (await indexedDBService.getFileMetadata(hash))!;
    expect(dateZones).toBeDefined();
    await indexedDBService.saveFileMetadata(record);
    indexedDBService.clearCaches(hash);

    const after = await csvRows(await buildExportCsv(hash, null, total));
    expect(before.some(r => isDay(r.followingDate))).toBe(true);
    expect(after.every(r => r.followingDate === '' && r.followersDate === '')).toBe(true);
    expect(after.map(r => [r.following, r.followers])).toEqual(
      before.map(r => [r.following, r.followers])
    );
  });

  // Since GH#286 PR-3 the free sample is the HTML report told to stop at ten.
  it('the free sample carries the dates, through the same builder', async () => {
    const hash = `free-${format}`;
    const total = await store(hash, format);
    const html = await readReport(
      await buildExportHtml(hash, null, total, makeReport({ sampleLimit: FREE_EXPORT_ROWS }))
    );
    expect(html).toMatch(/DATE_(following|followers|mutual|requested) [^<]*\d/);
  });
});
