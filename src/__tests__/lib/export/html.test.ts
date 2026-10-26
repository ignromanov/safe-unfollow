import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';
import { createFollowDateFormatter } from '@/lib/follow-dates';
import { makeReport, readBlobText } from '../../utils/report-context-fixture';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
}));

const { buildExportHtml } = await import('@/lib/export/html');
const { buildExportCsv } = await import('@/lib/export/csv');

function account(username: string, badges: AccountBadges['badges'] = {}): AccountBadges {
  return { username, badges };
}

/** Serves `at(i)` for i in [0, n) lazily, so a 60 000-row file is never held as one array. */
function serve(n: number, at: (i: number) => AccountBadges): void {
  getAccountsByRange.mockImplementation((_hash: string, start: number, end: number) =>
    Promise.resolve(Array.from({ length: Math.min(end, n) - start }, (_, i) => at(start + i)))
  );
}

function serveList(list: AccountBadges[]): void {
  serve(list.length, i => list[i] as AccountBadges);
}

function record(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fileName: 'instagram-alice_owner-2026-10-01.zip',
    uploadDate: new Date(2026, 9, 25, 9, 0, 0),
    dateZones: {},
    ...over,
  };
}

async function build(
  n: number,
  report = makeReport(),
  indices: number[] | null = null
): Promise<string> {
  return readBlobText(await buildExportHtml('hash', indices, n, report));
}

const rows = (html: string): number => html.split('<li class="row">').length - 1;

describe('buildExportHtml', () => {
  beforeEach(() => {
    getAccountsByRange.mockReset();
    getFileMetadata.mockReset();
    getFileMetadata.mockResolvedValue(record());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an html blob', async () => {
    serveList([account('a')]);
    const blob = await buildExportHtml('hash', null, 1, makeReport());
    expect(blob.type).toBe('text/html;charset=utf-8');
  });

  it('orders sections and lists each account once; following+pending lands in Other', async () => {
    serveList([
      account('a1', { mutuals: true, following: true, followers: true }),
      account('a2', { notFollowingBack: true, following: true }),
      account('a3', { following: true, pending: true }),
      account('a4', { notFollowedBack: true, followers: true }),
      account('a5', { notFollowingBack: true, following: true }),
    ]);
    const html = await build(5);

    const ids = [...html.matchAll(/<details open id="(\w+)"/g)].map(m => m[1]);
    expect(ids).toEqual(['notFollowingBack', 'notFollowedBack', 'mutuals', 'other']);
    for (const name of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      expect(html.split(`>@${name}<`).length - 1).toBe(1);
    }
    const other = html.slice(html.indexOf('id="other"'));
    expect(other).toContain('>@a3<');
    expect(other).toContain('LBL_PENDING');
    // Storage order is kept inside a section.
    expect(html.indexOf('>@a2<')).toBeLessThan(html.indexOf('>@a5<'));
  });

  it('shows full section totals, and a sample is the first rows in report order, not storage order', async () => {
    // Storage order is the reverse of report order, so a storage-prefix sample picks mutuals.
    const list = [
      ...Array.from({ length: 12 }, (_, i) => account(`a${i}`, { mutuals: true })),
      ...Array.from({ length: 20 }, (_, i) => account(`b${i}`, { notFollowedBack: true })),
      ...Array.from({ length: 4 }, (_, i) => account(`c${i}`, { notFollowingBack: true })),
    ];
    serveList(list);
    const report = makeReport({ sampleLimit: 10 });
    report.strings.sampleLine = 'SAMPLE_LINE';
    const html = await build(list.length, report);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bySection = (id: string): string[] =>
      [...doc.querySelectorAll(`#${id} li.row a`)].map(a => a.textContent ?? '');

    expect(bySection('notFollowingBack')).toEqual(['@c0', '@c1', '@c2', '@c3']);
    expect(bySection('notFollowedBack')).toEqual(['@b0', '@b1', '@b2', '@b3', '@b4', '@b5']);
    expect(bySection('mutuals')).toEqual([]);
    expect(rows(html)).toBe(10);
    for (const [id, count] of [
      ['notFollowingBack', '4'],
      ['notFollowedBack', '20'],
      ['mutuals', '12'],
    ] as const) {
      expect(doc.querySelector(`#${id} .count`)?.textContent).toBe(count);
    }
    expect(html).toContain('SAMPLE_LINE');
    // The sample line speaks for the cut; sections carry no ceiling note under a sample.
    expect(html).not.toContain('CEILING_SECTION');
    expect(html).not.toContain('CEILING_TOP');
  });

  it('carries no sample line for a paid file', async () => {
    serveList([account('a', { mutuals: true })]);
    expect(await build(1)).not.toContain('SAMPLE_LINE');
  });

  // 01:30 UTC on 1 March is still 29 February west of UTC, so the two zones disagree on the day
  // wherever the machine is west of Greenwich; run under TZ=America/Asuncion to see the split.
  it('writes the same day in the HTML as in the CSV, in both zones', async () => {
    const seconds = 1_709_256_600;
    getFileMetadata.mockResolvedValue(
      record({ dateZones: { following: 'local', followers: 'utc' } })
    );
    const list = [account('loc', { following: seconds }), account('utc', { followers: seconds })];

    serveList(list);
    const doc = new DOMParser().parseFromString(await build(2), 'text/html');
    const htmlDay = (name: string): string | null | undefined =>
      [...doc.querySelectorAll('li.row')]
        .find(li => li.querySelector('a')?.textContent === `@${name}`)
        ?.querySelector('time')
        ?.getAttribute('datetime');

    serveList(list);
    const csv = (await readBlobText(await buildExportCsv('hash', null, 2))).trim().split('\n');
    const header = (csv[0] ?? '').split(',');
    const cell = (name: string, column: string): string | undefined =>
      csv
        .slice(1)
        .find(r => r.startsWith(`${name},`))
        ?.split(',')[header.indexOf(column)];

    expect(htmlDay('loc')).toBeTruthy();
    expect(htmlDay('loc')).toBe(cell('loc', 'followingDate'));
    expect(htmlDay('utc')).toBeTruthy();
    expect(htmlDay('utc')).toBe(cell('utc', 'followersDate'));
  });

  it('adds caveats above the first section', async () => {
    getFileMetadata.mockResolvedValue(
      record({ followRequestsUnreadable: true, truncatedRelationshipFile: 'followers' })
    );
    serveList([account('a', { mutuals: true })]);
    const html = await build(1);

    expect(html).toContain('CAVEAT_FOLLOW_REQUESTS');
    expect(html).toContain('CAVEAT_TRUNCATED_FOLLOWERS');
    expect(html).not.toContain('CAVEAT_TRUNCATED_FOLLOWING');
    expect(html).not.toContain('CAVEAT_DATES_STALE');
    expect(html.indexOf('CAVEAT_FOLLOW_REQUESTS')).toBeLessThan(html.indexOf('<details'));
  });

  it('names the other truncated file', async () => {
    getFileMetadata.mockResolvedValue(record({ truncatedRelationshipFile: 'following' }));
    serveList([account('a')]);
    expect(await build(1)).toContain('CAVEAT_TRUNCATED_FOLLOWING');
  });

  it('says dates are stale for a record without zones, and renders no <time>', async () => {
    getFileMetadata.mockResolvedValue(record({ dateZones: undefined }));
    serveList([account('a', { following: 1_700_000_000 })]);
    const html = await build(1);
    expect(html).toContain('CAVEAT_DATES_STALE');
    expect(html).not.toContain('<time');
  });

  it('says nothing about stale dates when there is no record at all', async () => {
    getFileMetadata.mockResolvedValue(null);
    serveList([account('a', { following: 1_700_000_000 })]);
    const html = await build(1);
    expect(html).not.toContain('CAVEAT_DATES_STALE');
    expect(html).not.toContain('<time');
  });

  it('puts the date in the <title> and keeps the <h1> as the bare title', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12, 0, 0));
    serveList([account('a')]);
    const html = await build(1);
    const made = createFollowDateFormatter('en')(
      new Date(2026, 9, 25, 12).getTime() / 1000,
      'local'
    );
    expect(html).toContain(`<title>REPORT_TITLE · ${made}</title>`);
    expect(html).toContain('<h1>REPORT_TITLE</h1>');
  });

  it('drops a label that has no resolved string instead of printing the internal key', async () => {
    serveList([account('a', { mutuals: true, close: true, restricted: true })]);
    const html = await build(1);
    expect(html).toContain('LBL_CLOSE');
    expect(html).not.toContain('restricted');
  });

  it('closes the document with exactly one site link carrying the footer', async () => {
    serveList([account('a', { mutuals: true })]);
    const html = await build(1);
    const link = '<a href="https://safeunfollow.app/?from=report" rel="noreferrer">';
    expect(html.split(link).length - 1).toBe(1);
    expect(html).toContain(`${link}FOOTER_TEXT</a>`);
  });

  describe('header dates', () => {
    const fmt = (d: Date): string =>
      createFollowDateFormatter('en')(Math.floor(d.getTime() / 1000), 'local');

    it('shows madeOn and uploadedOn when the upload was on another day', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 25, 12, 0, 0));
      getFileMetadata.mockResolvedValue(record({ uploadDate: new Date(2026, 9, 1, 12, 0, 0) }));
      serveList([account('a')]);
      const html = await build(1);
      expect(html).toContain(`MADE_ON ${fmt(new Date(2026, 9, 25, 12))}`);
      expect(html).toContain(`UPLOADED_ON ${fmt(new Date(2026, 9, 1, 12))}`);
    });

    it('shows only madeOn when the upload was today', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 25, 12, 0, 0));
      getFileMetadata.mockResolvedValue(record({ uploadDate: new Date(2026, 9, 25, 1, 0, 0) }));
      serveList([account('a')]);
      const html = await build(1);
      expect(html).toContain('MADE_ON');
      expect(html).not.toContain('UPLOADED_ON');
    });

    it.each([
      ['undefined', undefined],
      ['an invalid date', new Date('garbage')],
    ])('does not throw and omits uploadedOn when uploadDate is %s', async (_name, uploadDate) => {
      getFileMetadata.mockResolvedValue(record({ uploadDate }));
      serveList([account('a')]);
      const html = await build(1);
      expect(html).toContain('MADE_ON');
      expect(html).not.toContain('UPLOADED_ON');
    });

    it('shows only madeOn when the record is missing', async () => {
      getFileMetadata.mockResolvedValue(null);
      serveList([account('a')]);
      const html = await build(1);
      expect(html).toContain('MADE_ON');
      expect(html).not.toContain('UPLOADED_ON');
    });
  });

  it('cuts at the ceiling and still announces the sections it left out', async () => {
    const n = 60_010;
    serve(n, i =>
      i < 60_000
        ? account(`u${i}`, { notFollowingBack: true })
        : account(`m${i}`, { mutuals: true })
    );
    const html = await build(n);

    expect(rows(html)).toBe(50_000);
    expect(html).toContain('CEILING_TOP 50,000');
    expect(html).toContain('CEILING_SECTION 60,000');
    const mutuals = html.slice(
      html.indexOf('id="mutuals"'),
      html.indexOf('</details>', html.indexOf('id="mutuals"'))
    );
    expect(mutuals).toContain('HEADING_mutuals');
    expect(mutuals).toContain('<span class="count">10</span>');
    expect(mutuals).toContain('CEILING_SECTION 10');
    expect(mutuals).not.toContain('<li');
  }, 30_000);

  it('builds a valid document for an empty view', async () => {
    serveList([account('a', { mutuals: true })]);
    const html = await build(1, makeReport(), []);
    expect(html).toContain('<h1>REPORT_TITLE</h1>');
    expect(html).not.toContain('<details');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('sets lang and dir on the root for a right-to-left language', async () => {
    serveList([account('a')]);
    const html = await build(1, makeReport({ lang: 'ar', dir: 'rtl' }));
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it('keeps an ISO datetime on the date line in a right-to-left file', async () => {
    getFileMetadata.mockResolvedValue(record({ dateZones: { following: 'utc' } }));
    serveList([account('a', { following: 1_709_256_600 })]);
    const html = await build(1, makeReport({ lang: 'ar', dir: 'rtl' }));
    expect(html).toMatch(/<time datetime="\d{4}-\d{2}-\d{2}">/);
  });

  it('shows the scope and, when the search narrowed the view, says so', async () => {
    serveList([account('a')]);
    const report = makeReport();
    report.strings.searchNarrowed = 'SEARCH_NARROWED';
    const html = await build(1, report);
    expect(html).toContain('SCOPE_LINE');
    expect(html).toContain('SEARCH_NARROWED');
  });

  it('reports progress up to the full row count', async () => {
    serveList([account('a'), account('b')]);
    const onProgress = vi.fn();
    await buildExportHtml('hash', null, 2, makeReport(), onProgress);
    expect(onProgress).toHaveBeenLastCalledWith({ processed: 2, total: 2 });
  });

  it('reports progress during pass 1 too: monotone, strictly inside (0, total) before the end', async () => {
    const n = 2_500;
    serve(n, i => account(`u${i}`, { mutuals: true }));
    const calls: number[] = [];
    let firstProgressAfterReads = -1;
    const baseImpl = getAccountsByRange.getMockImplementation();
    let reads = 0;
    getAccountsByRange.mockImplementation((...args: unknown[]) => {
      reads += 1;
      return baseImpl?.(...args);
    });
    await buildExportHtml('hash', null, n, makeReport(), p => {
      if (calls.length === 0) firstProgressAfterReads = reads;
      calls.push(p.processed);
    });
    const chunksPerPass = reads / 2;
    // The first progress call lands within pass 1, before any pass-2 read.
    expect(firstProgressAfterReads).toBeLessThanOrEqual(chunksPerPass);
    expect(calls.some(c => c > 0 && c < n)).toBe(true);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
    expect(calls.at(-1)).toBe(n);
  });
});
