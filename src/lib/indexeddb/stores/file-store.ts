/**
 * File Store - CRUD operations for file metadata records
 */

import type { FileMetadataRecord } from '../indexeddb-schema';
import { STORES } from '../indexeddb-schema';
import { executeRead, executeWrite, getAllRecords } from '../transaction-helpers';

export async function saveFileMetadata(
  db: IDBDatabase,
  metadata: FileMetadataRecord
): Promise<void> {
  const tx = db.transaction([STORES.FILES], 'readwrite');
  const store = tx.objectStore(STORES.FILES);
  await executeWrite(store, metadata);
}

export async function getFileMetadata(
  db: IDBDatabase,
  fileHash: string
): Promise<FileMetadataRecord | null> {
  const tx = db.transaction([STORES.FILES], 'readonly');
  const store = tx.objectStore(STORES.FILES);

  const data = await executeRead<FileMetadataRecord>(store, fileHash);
  if (data?.uploadDate) {
    data.uploadDate = new Date(data.uploadDate);
  }
  return data ?? null;
}

export async function getAllFiles(db: IDBDatabase): Promise<FileMetadataRecord[]> {
  const tx = db.transaction([STORES.FILES], 'readonly');
  const store = tx.objectStore(STORES.FILES);

  const files = await getAllRecords<FileMetadataRecord>(store);
  return files.map(file => {
    if (file.uploadDate) {
      file.uploadDate = new Date(file.uploadDate);
    }
    return file;
  });
}
