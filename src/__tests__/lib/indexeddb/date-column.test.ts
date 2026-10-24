import { describe, expect, it } from 'vitest';

import type { AccountBadges, BadgeMap } from '@/core/types';
import {
  buildDateColumn,
  forEachDateInRange,
  isStorableTimestamp,
  type DateColumn,
} from '@/lib/indexeddb/date-column';

describe('isStorableTimestamp', () => {
  it.each([1, 1704067200, 4294967295])('accepts %s', v => {
    expect(isStorableTimestamp(v)).toBe(true);
  });

  it.each([0, -1, 1.5, 4294967296, 1704067200000, true, undefined, NaN, '1704067200'])(
    'rejects %s',
    v => {
      expect(isStorableTimestamp(v)).toBe(false);
    }
  );
});

describe('buildDateColumn', () => {
  const acc = (username: string, badges: BadgeMap): AccountBadges => ({ username, badges });

  it('keeps only accounts with a storable date, at their array position', () => {
    const col = buildDateColumn(
      [
        acc('a', { followers: 100 }),
        acc('b', { followers: true }),
        acc('c', {}),
        acc('d', { followers: 300 }),
      ],
      'followers'
    );
    expect(Array.from(col!.indices)).toEqual([0, 3]);
    expect(Array.from(col!.values)).toEqual([100, 300]);
  });

  it('returns null when no account has a storable date', () => {
    expect(
      buildDateColumn(
        [acc('a', { followers: true }), acc('b', { followers: 1704067200000 })],
        'followers'
      )
    ).toBeNull();
  });

  it('never wraps a millisecond timestamp into a plausible-looking second', () => {
    const col = buildDateColumn(
      [acc('a', { following: 1704067200000 }), acc('b', { following: 5 })],
      'following'
    );
    expect(Array.from(col!.values)).toEqual([5]);
  });

  it('costs exactly 8 bytes per dated member', () => {
    const accounts = Array.from({ length: 1000 }, (_, i) =>
      acc(`u${i}`, { followers: i % 2 ? 1000 + i : true })
    );
    const col = buildDateColumn(accounts, 'followers')!;
    expect(col.indices.byteLength + col.values.byteLength).toBe(500 * 8);
  });
});

describe('forEachDateInRange', () => {
  const col: DateColumn = {
    indices: Uint32Array.from([2, 5, 9]),
    values: Uint32Array.from([20, 50, 90]),
  };
  const collect = (s: number, e: number): [number, number][] => {
    const out: [number, number][] = [];
    forEachDateInRange(col, s, e, (i, t) => out.push([i, t]));
    return out;
  };

  it('yields members inside [start, end)', () => expect(collect(3, 9)).toEqual([[5, 50]]));
  it('includes start, excludes end', () =>
    expect(collect(5, 10)).toEqual([
      [5, 50],
      [9, 90],
    ]));
  it('yields nothing for a range between members', () => expect(collect(6, 9)).toEqual([]));
  it('yields nothing past the last member', () => expect(collect(10, 20)).toEqual([]));
  it('yields everything for a covering range', () => expect(collect(0, 100)).toHaveLength(3));
});
