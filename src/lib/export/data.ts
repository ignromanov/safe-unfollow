/**
 * Chunked account loading for export — avoids materializing the full
 * (potentially 1M-row) account list in memory at once.
 */

import type { AccountBadges } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

const CHUNK_SIZE = 1000;

// Upper bound on the index span (max - min + 1) fetched per getAccountsByRange
// call. getAccountsByRange has no internal chunking, so for sparse filters
// (e.g. a badge scattered across a 1M-account file) batching by index COUNT
// alone could still request a huge contiguous range and materialize almost
// the whole file. Capping the span keeps each fetch small regardless of how
// spread out the matching indices are.
const MAX_FETCH_SPAN = 2000;

export interface ExportRow {
  index: number;
  account: AccountBadges;
}

/**
 * Groups sorted indices into runs whose index span (max - min + 1) never
 * exceeds `maxSpan`. A run may contain anywhere from 1 to `CHUNK_SIZE`
 * indices — dense selections fill a run quickly, sparse ones are capped by
 * span instead of count.
 */
function groupIndicesBySpan(sortedIndices: number[], maxSpan: number): number[][] {
  const groups: number[][] = [];
  let currentGroup: number[] = [];

  for (const index of sortedIndices) {
    const groupStart = currentGroup[0];
    const wouldExceedSpan = groupStart !== undefined && index - groupStart + 1 > maxSpan;
    const wouldExceedCount = currentGroup.length >= CHUNK_SIZE;

    if (wouldExceedSpan || wouldExceedCount) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(index);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
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

  const sortedIndices = [...indices].sort((a, b) => a - b);
  const groups = groupIndicesBySpan(sortedIndices, MAX_FETCH_SPAN);

  for (const group of groups) {
    const min = group[0];
    const max = group[group.length - 1];
    if (min === undefined || max === undefined) continue;

    const accounts = await indexedDBService.getAccountsByRange(fileHash, min, max + 1);

    const rows: ExportRow[] = [];
    for (const index of group) {
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
