/**
 * Chunked account loading for export — avoids materializing the full
 * (potentially 1M-row) account list in memory at once.
 */

import type { AccountBadges } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

const CHUNK_SIZE = 1000;

export interface ExportRow {
  index: number;
  account: AccountBadges;
}

/**
 * Yields accounts for the given indices (or the full range when `indices`
 * is null, meaning "all accounts") in fixed-size chunks, preserving order.
 */
export async function* iterateAccountsForExport(
  fileHash: string,
  indices: number[] | null,
  totalCount: number
): AsyncGenerator<ExportRow[]> {
  if (indices === null) {
    for (let start = 0; start < totalCount; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, totalCount);
      const accounts = await indexedDBService.getAccountsByRange(fileHash, start, end);
      yield accounts.map((account, i) => ({ index: start + i, account }));
    }
    return;
  }

  for (let batchStart = 0; batchStart < indices.length; batchStart += CHUNK_SIZE) {
    const batch = indices.slice(batchStart, batchStart + CHUNK_SIZE);
    const min = Math.min(...batch);
    const max = Math.max(...batch);
    const accounts = await indexedDBService.getAccountsByRange(fileHash, min, max + 1);

    const rows: ExportRow[] = [];
    for (const index of batch) {
      const account = accounts[index - min];
      if (account) {
        rows.push({ index, account });
      }
    }
    yield rows;
  }
}

export function getExportRowCount(indices: number[] | null, totalCount: number): number {
  return indices === null ? totalCount : indices.length;
}
