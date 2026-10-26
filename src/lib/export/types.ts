/**
 * Shared export types — used by the builders, the export worker, and the UI.
 */

export type ExportFormat = 'csv' | 'json';

/**
 * What the worker is asked to build. A union of per-format shapes, not a bare
 * format, so a later format can carry its own options without every other
 * format growing optional fields.
 */
export type ExportRequest = { format: 'csv' } | { format: 'json' };

/**
 * Closes a switch over a format. The `never` parameter turns a forgotten case
 * into a compile error; the throw stops it from quietly building another format.
 */
export function assertNever(value: never): never {
  // A request is an object; name its format, not "[object Object]". Narrowing to
  // `never` leaves no property to read, hence the widening.
  const unknownValue: unknown = value;
  const name =
    typeof unknownValue === 'object' && unknownValue !== null && 'format' in unknownValue
      ? unknownValue.format
      : unknownValue;
  throw new Error(`Unhandled export format: ${String(name)}`);
}

export interface ExportProgress {
  processed: number;
  total: number;
}

/**
 * Reports how many rows have been written so far. Called once per chunk, so a
 * 1M-row export emits ~1000 updates rather than one per row.
 */
export type ExportProgressCallback = (progress: ExportProgress) => void;
