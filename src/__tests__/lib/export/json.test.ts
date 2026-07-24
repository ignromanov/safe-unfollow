import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';

const { getAccountsByRange } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange },
}));

const { buildExportJson } = await import('@/lib/export/json');

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

describe('buildExportJson', () => {
  beforeEach(() => {
    getAccountsByRange.mockReset();
  });

  it('builds a JSON array with username, href, and badges per account', async () => {
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: true }),
      account('bob'),
    ]);

    const blob = await buildExportJson('hash1', null, 2);
    const text = await readBlobText(blob);
    const parsed = JSON.parse(text);

    expect(parsed).toEqual([
      { username: 'alice', href: 'https://instagram.com/alice', badges: { following: true } },
      { username: 'bob', href: 'https://instagram.com/bob', badges: {} },
    ]);
  });

  it('produces a valid empty array when there are no rows', async () => {
    const blob = await buildExportJson('hash1', [], 0);
    const text = await readBlobText(blob);

    expect(JSON.parse(text)).toEqual([]);
  });

  it('produces valid JSON across multiple chunk boundaries', async () => {
    getAccountsByRange
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => account(`user${i}`)))
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => account(`user${1000 + i}`)));

    const blob = await buildExportJson('hash1', null, 1500);
    const text = await readBlobText(blob);
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1500);
    expect(parsed[0].username).toBe('user0');
    expect(parsed[1499].username).toBe('user1499');
  });
});
