import { dbCache, generateFileHash } from '@/lib/indexeddb/indexeddb-cache';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IndexedDB service
vi.mock('@/lib/indexeddb/indexeddb-service');

const mockIndexedDBService = vi.mocked(indexedDBService);

describe('IndexedDBCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return cached data if exists and not expired', async () => {
      const mockMetadata = {
        fileHash: 'test-hash',
        fileName: 'test.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now() - 1000, // 1 second ago
        version: 2,
      };

      mockIndexedDBService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockIndexedDBService.saveFileMetadata.mockResolvedValue();

      const result = await dbCache.get('test-hash');

      expect(result).toEqual({
        fileHash: 'test-hash',
        metadata: {
          name: 'test.zip',
          size: 1024,
          uploadDate: mockMetadata.uploadDate,
          accountCount: 100,
        },
        timestamp: expect.any(Number),
      });
    });

    it('should return null if file does not exist', async () => {
      mockIndexedDBService.getFileMetadata.mockResolvedValue(null);

      const result = await dbCache.get('nonexistent-hash');

      expect(result).toBeNull();
    });

    it('should return null if cache is expired (>7 days)', async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

      const mockMetadata = {
        fileHash: 'test-hash',
        fileName: 'test.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: eightDaysAgo,
        version: 2,
      };

      mockIndexedDBService.getFileMetadata.mockResolvedValue(mockMetadata);

      const result = await dbCache.get('test-hash');

      expect(result).toBeNull();
    });

    it('should update last accessed time when cache is hit', async () => {
      const mockMetadata = {
        fileHash: 'test-hash',
        fileName: 'test.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now() - 1000,
        version: 2,
      };

      mockIndexedDBService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockIndexedDBService.saveFileMetadata.mockResolvedValue();

      await dbCache.get('test-hash');

      expect(mockIndexedDBService.saveFileMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          fileHash: 'test-hash',
          lastAccessed: expect.any(Number),
        })
      );
    });

    it('should handle cache exactly at 7 day boundary', async () => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const mockMetadata = {
        fileHash: 'test-hash',
        fileName: 'test.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: sevenDaysAgo,
        version: 2,
      };

      mockIndexedDBService.getFileMetadata.mockResolvedValue(mockMetadata);

      const result = await dbCache.get('test-hash');

      // At exactly 7 days, should still be valid
      expect(result).not.toBeNull();
    });

    it('should handle metadata with different date formats', async () => {
      const mockMetadata = {
        fileHash: 'test-hash',
        fileName: 'test.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01T10:00:00Z'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
      };

      mockIndexedDBService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockIndexedDBService.saveFileMetadata.mockResolvedValue();

      const result = await dbCache.get('test-hash');

      expect(result?.metadata.uploadDate).toBeInstanceOf(Date);
    });
  });

  describe('set', () => {
    it('should log deprecation warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await dbCache.set({
        fileHash: 'test-hash',
        metadata: {
          name: 'test.zip',
          size: 1024,
          uploadDate: new Date(),
          accountCount: 100,
        },
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('set() is deprecated'));

      consoleSpy.mockRestore();
    });

    it('should not throw error', async () => {
      await expect(
        dbCache.set({
          fileHash: 'test-hash',
          metadata: {
            name: 'test.zip',
            size: 1024,
            uploadDate: new Date(),
            accountCount: 100,
          },
          timestamp: Date.now(),
        })
      ).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all files', async () => {
      const mockFiles = [
        {
          fileHash: 'hash1',
          fileName: 'file1.zip',
          fileSize: 1024,
          uploadDate: new Date(),
          accountCount: 100,
          lastAccessed: Date.now(),
          version: 2,
        },
        {
          fileHash: 'hash2',
          fileName: 'file2.zip',
          fileSize: 2048,
          uploadDate: new Date(),
          accountCount: 200,
          lastAccessed: Date.now(),
          version: 2,
        },
      ];

      mockIndexedDBService.getAllFiles.mockResolvedValue(mockFiles);
      mockIndexedDBService.clearFile.mockResolvedValue();
      mockIndexedDBService.clearCaches.mockImplementation(() => {});

      await dbCache.clear();

      expect(mockIndexedDBService.getAllFiles).toHaveBeenCalled();
      expect(mockIndexedDBService.clearFile).toHaveBeenCalledWith('hash1');
      expect(mockIndexedDBService.clearFile).toHaveBeenCalledWith('hash2');
      expect(mockIndexedDBService.clearCaches).toHaveBeenCalled();
    });

    it('should handle empty file list', async () => {
      mockIndexedDBService.getAllFiles.mockResolvedValue([]);
      mockIndexedDBService.clearCaches.mockImplementation(() => {});

      await expect(dbCache.clear()).resolves.not.toThrow();

      expect(mockIndexedDBService.clearCaches).toHaveBeenCalled();
    });

    it('should handle errors during file clearing', async () => {
      const mockFiles = [
        {
          fileHash: 'hash1',
          fileName: 'file1.zip',
          fileSize: 1024,
          uploadDate: new Date(),
          accountCount: 100,
          lastAccessed: Date.now(),
          version: 2,
        },
      ];

      mockIndexedDBService.getAllFiles.mockResolvedValue(mockFiles);
      mockIndexedDBService.clearFile.mockRejectedValue(new Error('Clear failed'));

      await expect(dbCache.clear()).rejects.toThrow('Clear failed');
    });
  });
});

describe('generateFileHash', () => {
  it('should generate consistent hash for same file', async () => {
    const content = 'test file content';
    const file1 = new File([content], 'test.zip', { type: 'application/zip' });
    const file2 = new File([content], 'test.zip', { type: 'application/zip' });

    const hash1 = await generateFileHash(file1);
    const hash2 = await generateFileHash(file2);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 produces 64 hex chars
  });

  it('should generate different hashes for different files', async () => {
    const file1 = new File(['content1'], 'test1.zip', { type: 'application/zip' });
    const file2 = new File(['content2'], 'test2.zip', { type: 'application/zip' });

    const hash1 = await generateFileHash(file1);
    const hash2 = await generateFileHash(file2);

    expect(hash1).not.toBe(hash2);
  });

  it('should hash large files by sampling head/tail, not the whole file', async () => {
    // Create a file larger than 1MB
    const largeContent = new Uint8Array(2 * 1024 * 1024); // 2MB
    largeContent.fill(1);

    const largeFile = new File([largeContent], 'large.zip', { type: 'application/zip' });

    const hash = await generateFileHash(largeFile);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  // GH#22: the cache key used to be a hash of the first megabyte only. An Instagram
  // export ZIP has stable, alphabetically-early entries up front (ads_information/…)
  // and the data this product actually reads (connections/followers_and_following/…)
  // much deeper in the archive — so two different exports could share their first
  // megabyte and collide on the cache key, silently serving the stale snapshot.
  it('should produce different hashes for files sharing the first megabyte but differing later (GH#22)', async () => {
    const sharedHead = new Uint8Array(1.5 * 1024 * 1024).fill(1); // > 1MB, so it fully covers the old head-only sample
    const tailA = new Uint8Array(512 * 1024).fill(2);
    const tailB = new Uint8Array(512 * 1024).fill(3);

    const fileA = new File([sharedHead, tailA], 'export-a.zip', { type: 'application/zip' });
    const fileB = new File([sharedHead, tailB], 'export-b.zip', { type: 'application/zip' });

    const hashA = await generateFileHash(fileA);
    const hashB = await generateFileHash(fileB);

    expect(hashA).not.toBe(hashB);
  });

  // GH#22: the fix folds file.size into the digest, since two files can share an
  // identical sampled head AND tail while differing only in an unsampled middle.
  it('should produce different hashes for files with matching head/tail but different size (GH#22)', async () => {
    const head = new Uint8Array(1024 * 1024).fill(7); // exactly the sampled head
    const tail = new Uint8Array(1024 * 1024).fill(9); // exactly the sampled tail
    const middleA = new Uint8Array(512 * 1024).fill(3); // unsampled middle, size = 2.5MB
    const middleB = new Uint8Array(1024 * 1024).fill(3); // unsampled middle, size = 3MB

    const fileA = new File([head, middleA, tail], 'a.zip', { type: 'application/zip' });
    const fileB = new File([head, middleB, tail], 'b.zip', { type: 'application/zip' });

    const hashA = await generateFileHash(fileA);
    const hashB = await generateFileHash(fileB);

    expect(hashA).not.toBe(hashB);
  });

  it('should hash entire file if smaller than 1MB', async () => {
    const smallContent = new Uint8Array(512 * 1024); // 512KB
    smallContent.fill(1);

    const smallFile = new File([smallContent], 'small.zip', { type: 'application/zip' });

    const hash = await generateFileHash(smallFile);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should throw EMPTY_FILE error for empty files', async () => {
    const emptyFile = new File([], 'empty.zip', { type: 'application/zip' });

    await expect(generateFileHash(emptyFile)).rejects.toMatchObject({
      message: 'File is empty',
      code: 'EMPTY_FILE',
    });
  });

  it('should handle binary content', async () => {
    const binaryContent = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
    const binaryFile = new File([binaryContent], 'binary.zip', { type: 'application/zip' });

    const hash = await generateFileHash(binaryFile);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should use crypto.subtle for hashing', async () => {
    const digestSpy = vi.spyOn(crypto.subtle, 'digest');

    const file = new File(['test'], 'test.zip', { type: 'application/zip' });
    const hash = await generateFileHash(file);

    expect(digestSpy).toHaveBeenCalled();
    expect(digestSpy.mock.calls[0]?.[0]).toBe('SHA-256');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    digestSpy.mockRestore();
  });

  it('should handle files with special characters in content', async () => {
    const specialContent = '🎉 Special chars: äöü ñ 中文 العربية';
    const file = new File([specialContent], 'special.zip', { type: 'application/zip' });

    const hash = await generateFileHash(file);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
