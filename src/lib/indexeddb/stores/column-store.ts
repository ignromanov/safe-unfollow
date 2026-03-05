/**
 * Column Store - Columnar data append/read operations for packed string columns
 */

import type { ColumnRecord } from '../indexeddb-schema';
import { executeRead, executeWrite } from '../transaction-helpers';
import { STORES } from '../indexeddb-schema';

export async function appendColumn(
  tx: IDBTransaction,
  fileHash: string,
  column: 'usernames' | 'displayNames' | 'hrefs',
  newData: { data: Uint8Array; offsets: Uint32Array; length: number },
  startIndex: number
): Promise<void> {
  const store = tx.objectStore(STORES.COLUMNS);

  // Get existing column or create new
  const existing = await executeRead<ColumnRecord>(store, [fileHash, column]);

  let finalData: Uint8Array;
  let finalOffsets: Uint32Array;
  let finalLength: number;

  if (existing && startIndex > 0) {
    // Append to existing column
    const oldDataSize = existing.data.byteLength;
    const newDataSize = newData.data.byteLength;

    finalData = new Uint8Array(oldDataSize + newDataSize);
    finalData.set(existing.data, 0);
    finalData.set(newData.data, oldDataSize);

    finalOffsets = new Uint32Array(existing.length + newData.length + 1);
    finalOffsets.set(existing.offsets!, 0);

    // Adjust new offsets
    for (let i = 0; i < newData.offsets.length; i++) {
      const offset = newData.offsets[i];
      if (offset !== undefined) {
        finalOffsets[existing.length + i] = oldDataSize + offset;
      }
    }

    finalLength = existing.length + newData.length;
  } else {
    // First chunk
    finalData = newData.data;
    finalOffsets = newData.offsets;
    finalLength = newData.length;
  }

  const record: ColumnRecord = {
    fileHash,
    column,
    data: finalData,
    offsets: finalOffsets,
    length: finalLength,
  };

  await executeWrite(store, record);
}
