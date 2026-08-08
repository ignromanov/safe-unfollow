/**
 * JSON export builder — respects active filters/search and accumulates one
 * string per chunk (not per row), so a 1M-row export never holds a second
 * full copy of the output in memory.
 */

import { getExportRowCount, iterateAccountsForExport } from './data';
import type { ExportProgressCallback } from './types';

/**
 * Builds a JSON Blob for the given (already filtered) account indices.
 * `indices === null` means "export all accounts".
 */
export async function buildExportJson(
  fileHash: string,
  indices: number[] | null,
  totalCount: number,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  // One Blob part per chunk. Blob accepts the parts array directly, so the
  // output is never materialized as a single joined string.
  const parts: string[] = ['['];
  const total = getExportRowCount(indices, totalCount);
  let processed = 0;
  let isFirst = true;

  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    let buffer = '';
    for (const { account } of chunk) {
      const entry = JSON.stringify({
        username: account.username,
        href: `https://instagram.com/${account.username}`,
        badges: account.badges,
      });
      buffer += isFirst ? entry : `,${entry}`;
      isFirst = false;
    }
    if (buffer) parts.push(buffer);

    processed += chunk.length;
    onProgress?.({ processed, total });
  }

  parts.push(']');
  return new Blob(parts, { type: 'application/json;charset=utf-8' });
}
