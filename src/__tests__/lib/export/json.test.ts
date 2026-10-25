import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
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
    getFileMetadata.mockReset();
    getFileMetadata.mockResolvedValue(null);
  });

  it('should build a JSON array with username, href, and badges per account', async () => {
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: true }),
      account('bob'),
    ]);

    const blob = await buildExportJson('hash1', null, 2);
    const text = await readBlobText(blob);
    const parsed = JSON.parse(text);

    expect(parsed).toEqual([
      {
        username: 'alice',
        href: 'https://instagram.com/alice',
        badges: { following: true },
        dates: {},
      },
      { username: 'bob', href: 'https://instagram.com/bob', badges: {}, dates: {} },
    ]);
  });

  it('writes badges as presence flags even when the store returns dates (GH#285)', async () => {
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: 1704067200, mutuals: true }),
    ]);
    const parsed = JSON.parse(await readBlobText(await buildExportJson('hash1', null, 1)));
    expect(parsed[0].badges).toEqual({ following: true, mutuals: true });
  });

  it('writes a dates object beside badges, with a key only for a known date (GH#285 PR-3)', async () => {
    getFileMetadata.mockResolvedValue({ dateZones: { following: 'utc', followers: 'utc' } });
    getAccountsByRange.mockResolvedValueOnce([
      account('alice', { following: 1727654400, followers: true, mutuals: true }),
    ]);
    const parsed = JSON.parse(await readBlobText(await buildExportJson('hash1', null, 1)));
    expect(parsed[0].dates).toEqual({ following: '2024-09-30' });
    expect(parsed[0].badges).toEqual({ following: true, followers: true, mutuals: true });
  });

  it('writes no dates for a file stored before date zones existed', async () => {
    getFileMetadata.mockResolvedValue({ datesStored: true });
    getAccountsByRange.mockResolvedValueOnce([account('alice', { following: 1727654400 })]);
    const parsed = JSON.parse(await readBlobText(await buildExportJson('hash1', null, 1)));
    expect(parsed[0].dates).toEqual({});
  });

  it('should produce a valid empty array when there are no rows', async () => {
    const blob = await buildExportJson('hash1', [], 0);
    const text = await readBlobText(blob);

    expect(JSON.parse(text)).toEqual([]);
  });

  it('should report progress after each chunk', async () => {
    getAccountsByRange
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => account(`user${i}`)))
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => account(`user${1000 + i}`)));
    const onProgress = vi.fn();

    await buildExportJson('hash1', null, 1500, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith({ processed: 1500, total: 1500 });
  });

  it('should produce valid JSON across multiple chunk boundaries', async () => {
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
