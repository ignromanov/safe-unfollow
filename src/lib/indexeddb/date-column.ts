import type { AccountBadges, BadgeKey } from '@/core/types';

/**
 * Sparse date column for one time-based badge.
 *
 * Sparse because most members of a badge carry no date (`true`) and a dense
 * Uint32Array per badge would cost 4 bytes for every account in the export;
 * here a dated member costs 8 bytes and an undated one nothing
 * (see 00-INDEX.md D1).
 *
 * `0` is never stored, matching `presence()`: a zero is "no date", not 1970.
 * Timestamps are Unix seconds. Uint32Array wraps silently, so anything outside
 * [1, 2^32 - 1] (milliseconds, negatives, fractions) is dropped, not stored.
 */
export interface DateColumn {
  /** Account positions, strictly ascending. */
  indices: Uint32Array;
  /** Unix seconds, parallel to `indices`. */
  values: Uint32Array;
}

const MAX_UINT32 = 0xffffffff;

export function isStorableTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_UINT32;
}

export function buildDateColumn(
  accounts: readonly AccountBadges[],
  badge: BadgeKey
): DateColumn | null {
  // Two passes so the typed arrays are allocated once, at their final size.
  let count = 0;
  for (const account of accounts) {
    if (isStorableTimestamp(account.badges[badge])) count++;
  }
  if (count === 0) return null;

  const indices = new Uint32Array(count);
  const values = new Uint32Array(count);
  let k = 0;
  for (let i = 0; i < accounts.length; i++) {
    const value = accounts[i]!.badges[badge];
    if (!isStorableTimestamp(value)) continue;
    indices[k] = i;
    values[k] = value;
    k++;
  }
  return { indices, values };
}

/** Calls `fn` for each dated member whose index is in [start, end). */
export function forEachDateInRange(
  column: DateColumn,
  start: number,
  end: number,
  fn: (index: number, timestamp: number) => void
): void {
  const { indices, values } = column;

  // Lower bound: first position whose index is >= start.
  let lo = 0;
  let hi = indices.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (indices[mid]! < start) lo = mid + 1;
    else hi = mid;
  }

  for (let k = lo; k < indices.length && indices[k]! < end; k++) {
    fn(indices[k]!, values[k]!);
  }
}
