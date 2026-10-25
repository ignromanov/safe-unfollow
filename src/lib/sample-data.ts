/**
 * Sample Data Loader
 *
 * Loads pre-built sample data snapshot from public/sample-data.json.
 * Data is stored in IndexedDB using the same flow as real uploads.
 */

import type { AccountBadges } from '@/core/types';
import { indexedDBService } from './indexeddb/indexeddb-service';

// Sample file hash for demo data (consistent identifier)
const SAMPLE_FILE_HASH = 'sample-demo-data-v1';
const SAMPLE_DATA_URL = '/sample-data.json';

/** Snapshot format from public/sample-data.json */
interface SampleDataSnapshot {
  version: number;
  generatedAt: string;
  accountCount: number;
  accounts: AccountBadges[];
}

/**
 * Fetch sample data snapshot from public/
 * Throws on network or parse errors
 */
async function fetchSampleSnapshot(): Promise<SampleDataSnapshot> {
  const response = await fetch(SAMPLE_DATA_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch sample data: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SampleDataSnapshot;

  // Basic validation
  if (!data.accounts || !Array.isArray(data.accounts)) {
    throw new Error('Invalid sample data format: missing accounts array');
  }

  return data;
}

/**
 * Load and store sample data in IndexedDB
 *
 * Returns the file hash for accessing the sample data.
 * Idempotent: a cached copy that has follow dates stored (`datesStored`) is reused.
 * A copy cached before dates were persisted is cleared and rebuilt.
 */
export async function generateAndStoreSampleData(): Promise<{
  fileHash: string;
  accountCount: number;
}> {
  // Check if sample data already exists
  const existingMetadata = await indexedDBService.getFileMetadata(SAMPLE_FILE_HASH);

  if (existingMetadata) {
    if (existingMetadata.datesStored === true) {
      return {
        fileHash: SAMPLE_FILE_HASH,
        accountCount: existingMetadata.accountCount,
      };
    }
    // Cached before follow dates were persisted: drop it and rebuild from the snapshot
    await indexedDBService.clearFile(SAMPLE_FILE_HASH);
  }

  // Fetch snapshot from public/
  const snapshot = await fetchSampleSnapshot();

  // Store metadata
  await indexedDBService.saveFileMetadata({
    fileHash: SAMPLE_FILE_HASH,
    fileName: 'Sample Data (Demo)',
    fileSize: 0, // No actual file
    uploadDate: new Date(),
    accountCount: snapshot.accountCount,
    lastAccessed: Date.now(),
    version: 2,
  });

  // Store accounts using the same method as real uploads
  await indexedDBService.storeAllAccounts(SAMPLE_FILE_HASH, snapshot.accounts, {});

  return {
    fileHash: SAMPLE_FILE_HASH,
    accountCount: snapshot.accountCount,
  };
}

/**
 * Clear sample data from IndexedDB
 */
export async function clearSampleData(): Promise<void> {
  await indexedDBService.clearFile(SAMPLE_FILE_HASH);
}

/**
 * Check if sample data exists in IndexedDB
 */
export async function hasSampleData(): Promise<boolean> {
  const metadata = await indexedDBService.getFileMetadata(SAMPLE_FILE_HASH);
  return metadata !== null;
}

/**
 * Get sample data file hash (for use with filtering/display hooks)
 */
export function getSampleFileHash(): string {
  return SAMPLE_FILE_HASH;
}
