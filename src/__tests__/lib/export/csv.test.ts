import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';

const { getAccountsByRange } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange },
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
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('plain_user')).toBe('plain_user');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes values containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('buildExportCsv', () => {
  beforeEach(() => {
    getAccountsByRange.mockReset();
  });

  it('builds a header row plus one row per account with href and badge flags', async () => {
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: true, unfollowed: 1700000000 }),
      account('bob'),
    ]);

    const blob = await buildExportCsv('hash1', null, 2);
    const text = await readBlobText(blob);
    const lines = text.split('\n');

    expect(lines[0]).toBe(
      'username,href,following,followers,mutuals,notFollowingBack,notFollowedBack,unfollowed,pending,permanent,restricted,close,dismissed'
    );
    expect(lines[1]).toBe('alice,https://instagram.com/alice,1,0,0,0,0,1,0,0,0,0,0');
    expect(lines[2]).toBe('bob,https://instagram.com/bob,0,0,0,0,0,0,0,0,0,0,0');
  });

  it('escapes usernames containing commas or quotes', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('weird,"name')]);

    const blob = await buildExportCsv('hash1', null, 1);
    const text = await readBlobText(blob);
    const dataLine = text.split('\n')[1];

    expect(dataLine).toContain('"weird,""name"');
  });

  it('respects filtered indices by fetching only the relevant range', async () => {
    getAccountsByRange.mockResolvedValueOnce([account('c'), account('d'), account('e')]);

    // Indices 2 and 4 out of a wider range — only c(2) and e(4) should appear
    await buildExportCsv('hash1', [2, 4], 10);

    expect(getAccountsByRange).toHaveBeenCalledWith('hash1', 2, 5);
  });

  it('fetches in chunks of 1000 for the full "export all" case', async () => {
    getAccountsByRange.mockResolvedValue([]);

    await buildExportCsv('hash1', null, 2500);

    expect(getAccountsByRange).toHaveBeenCalledTimes(3);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(1, 'hash1', 0, 1000);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(2, 'hash1', 1000, 2000);
    expect(getAccountsByRange).toHaveBeenNthCalledWith(3, 'hash1', 2000, 2500);
  });

  it('caps the fetched index span for sparse filtered selections', async () => {
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
});
