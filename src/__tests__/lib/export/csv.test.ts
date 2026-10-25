import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
}));

const { buildExportCsv, escapeCsvField } = await import('@/lib/export/csv');

function account(username: string, badges: AccountBadges['badges'] = {}): AccountBadges {
  return { username, badges };
}

// jsdom's Blob does not implement .text()/.arrayBuffer() — read via FileReader instead.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('escapeCsvField', () => {
  it('should leave plain values untouched', () => {
    expect(escapeCsvField('plain_user')).toBe('plain_user');
  });

  it('should quote values containing a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('should double embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('should quote values containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('buildExportCsv', () => {
  beforeEach(() => {
    getAccountsByRange.mockReset();
    getFileMetadata.mockReset();
    getFileMetadata.mockResolvedValue(null);
  });

  it('should build a header row plus one row per account with href and badge flags', async () => {
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: true, unfollowed: 1700000000 }),
      account('bob'),
    ]);

    const blob = await buildExportCsv('hash1', null, 2);
    const text = await readBlobText(blob);
    const lines = text.split('\n');

    expect(lines[0]).toBe(
      'username,href,following,followers,mutuals,notFollowingBack,notFollowedBack,unfollowed,pending,permanent,restricted,close,dismissed,followingDate,followersDate,pendingDate,permanentDate,restrictedDate,closeDate,dismissedDate'
    );
    expect(lines[1]).toBe('alice,https://instagram.com/alice,1,0,0,0,0,1,0,0,0,0,0,,,,,,,');
    expect(lines[2]).toBe('bob,https://instagram.com/bob,0,0,0,0,0,0,0,0,0,0,0,,,,,,,');
  });

  it('writes 1 for a badge whose value is a date (GH#285)', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('alice', { following: 1704067200 })]);
    const text = await readBlobText(await buildExportCsv('hash1', null, 1));
    const [header, row] = text.trim().split('\n');
    const cols = header!.split(',');
    expect(row!.split(',')[cols.indexOf('following')]).toBe('1');
  });

  describe('follow dates (GH#285 PR-3)', () => {
    const SEP30 = 1727654400; // 2024-09-30 00:00:00 UTC

    async function exportRows(accounts: AccountBadges[]) {
      getAccountsByRange.mockResolvedValueOnce(accounts);
      const text = await readBlobText(await buildExportCsv('hash1', null, accounts.length));
      const [header, ...rows] = text
        .trim()
        .split('\n')
        .map(line => line.split(','));
      const cell = (row: number, column: string) => rows[row]![header!.indexOf(column)];
      return { header: header!, rows, cell };
    }

    it('writes a dated badge as its calendar day in <badge>Date', async () => {
      getFileMetadata.mockResolvedValue({ dateZones: { following: 'utc', followers: 'utc' } });
      const { cell } = await exportRows([account('alice', { following: SEP30, followers: true })]);
      expect(cell(0, 'followingDate')).toBe('2024-09-30');
      expect(cell(0, 'followersDate')).toBe('');
    });

    it('writes no date for a file stored before date zones existed', async () => {
      getFileMetadata.mockResolvedValue({ datesStored: true });
      const { cell } = await exportRows([account('alice', { following: SEP30 })]);
      expect(cell(0, 'following')).toBe('1');
      expect(cell(0, 'followingDate')).toBe('');
    });

    it('keeps every row as wide as the header', async () => {
      getFileMetadata.mockResolvedValue({ dateZones: { following: 'utc', dismissed: 'utc' } });
      const { header, rows } = await exportRows([
        account('alice', { following: SEP30, dismissed: SEP30 }),
        account('bob'),
      ]);
      expect(rows.map(row => row.length)).toEqual([header.length, header.length]);
    });

    it('reads the date zones once per export, not once per chunk', async () => {
      getAccountsByRange.mockResolvedValue([]);
      await buildExportCsv('hash1', null, 2500);
      expect(getFileMetadata).toHaveBeenCalledTimes(1);
      expect(getFileMetadata).toHaveBeenCalledWith('hash1');
    });
  });

  it('should escape usernames containing commas or quotes', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('weird,"name')]);

    const blob = await buildExportCsv('hash1', null, 1);
    const text = await readBlobText(blob);
    const dataLine = text.split('\n')[1];

    expect(dataLine).toContain('"weird,""name"');
  });

  it('should respect filtered indices by fetching only the relevant range', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('c'), account('d'), account('e')]);

    // Indices 2 and 4 out of a wider range — only c(2) and e(4) should appear
    await buildExportCsv('hash1', [2, 4], 10);

    expect(getAccountsByRange).toHaveBeenCalledWith('hash1', 2, 5);
  });

  it('should fetch in chunks of 1000 for the full "export all" case', async () => {
    getAccountsByRange.mockResolvedValue([]);

    await buildExportCsv('hash1', null, 2500);

    expect(getAccountsByRange).toHaveBeenCalledTimes(3);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(1, 'hash1', 0, 1000);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(2, 'hash1', 1000, 2000);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(3, 'hash1', 2000, 2500);
  });

  it('should cap the fetched index span for sparse filtered selections', async () => {
    getAccountsByRange.mockResolvedValue([]);

    // 200 indices scattered evenly across a 1M-account file (5000-index gaps) —
    // a naive count-based batch of 1000 would request a span of ~5,000,000.
    const sparseIndices = Array.from({ length: 200 }, (_, i) => i * 5000);

    await buildExportCsv('hash1', sparseIndices, 1_000_000);

    expect(getAccountsByRange.mock.calls.length).toBeGreaterThan(1);
    for (const [, start, end] of getAccountsByRange.mock.calls) {
      expect(end - start).toBeLessThanOrEqual(2000);
    }
  });

  it('should terminate every row with a newline, including the last one', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('alice'), account('bob')]);

    const blob = await buildExportCsv('hash1', null, 2);
    const text = await readBlobText(blob);

    expect(text.endsWith('\n')).toBe(true);
    // header + 2 rows, each newline-terminated -> no empty line in between
    expect(text.split('\n').filter(Boolean)).toHaveLength(3);
  });

  it('should report progress after each chunk', async () => {
    getAccountsByRange
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => account(`user${i}`)))
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => account(`user${1000 + i}`)));
    const onProgress = vi.fn();

    await buildExportCsv('hash1', null, 1500, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, { processed: 1000, total: 1500 });
    expect(onProgress).toHaveBeenLastCalledWith({ processed: 1500, total: 1500 });
  });

  it('should keep rows intact across chunk boundaries', async () => {
    getAccountsByRange
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => account(`user${i}`)))
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => account(`user${1000 + i}`)));

    const blob = await buildExportCsv('hash1', null, 1500);
    const text = await readBlobText(blob);
    const rows = text.split('\n').filter(Boolean);

    expect(rows).toHaveLength(1501); // header + 1500 accounts
    expect(rows[1]).toBe('user0,https://instagram.com/user0,0,0,0,0,0,0,0,0,0,0,0,,,,,,,');
    expect(rows[1000]).toBe('user999,https://instagram.com/user999,0,0,0,0,0,0,0,0,0,0,0,,,,,,,');
    expect(rows[1001]).toBe('user1000,https://instagram.com/user1000,0,0,0,0,0,0,0,0,0,0,0,,,,,,,');
    expect(rows[1500]).toBe('user1499,https://instagram.com/user1499,0,0,0,0,0,0,0,0,0,0,0,,,,,,,');
  });
});
