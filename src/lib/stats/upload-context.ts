/**
 * One id per upload attempt, carried by every event of that attempt.
 *
 * `relationship_file_truncated` joined its upload only through the Umami
 * session, and session identity has broken before (2026-08-20). With this key,
 * "what share of uploads are truncated" is one join. A random id, never the
 * file hash: the hash is derived from the reader's export and stable across
 * sessions.
 *
 * Set around each synchronous emit rather than held for the attempt: two
 * attempts can overlap (a file dropped while another parses), and a
 * module-wide "current attempt" would hand the first attempt's remaining
 * events the second one's id. Emits are synchronous, so this is exact.
 */
let current: string | undefined;

export function newUploadId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function withUpload<T>(id: string, emit: () => T): T {
  current = id;
  try {
    return emit();
  } finally {
    current = undefined;
  }
}

export function uploadIdField(): { upload_id?: string } {
  return current ? { upload_id: current } : {};
}
