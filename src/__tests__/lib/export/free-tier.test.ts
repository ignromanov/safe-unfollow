import { describe, expect, it } from 'vitest';

import {
  FREE_EXPORT_ROWS,
  PAYWALL_MIN_RATIO,
  PAYWALL_MIN_ROWS,
  capIndicesForFreeExport,
  isFreeExportCapped,
} from '@/lib/export/free-tier';

describe('free export cap', () => {
  it('hands over a fixed number of rows, not a share of the list', () => {
    // A percentage would give an influencer thousands of rows free and a casual
    // user four. Every reviewed product (PhantomBuster, Hunter.io, ZoomInfo)
    // caps on an absolute count for the same reason.
    expect(FREE_EXPORT_ROWS).toBe(10);
  });

  describe('when the reader is looking at everything', () => {
    it('takes the first rows of the dataset', () => {
      expect(capIndicesForFreeExport(null, 500)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('never asks for rows the dataset does not have', () => {
      expect(capIndicesForFreeExport(null, 3)).toEqual([0, 1, 2]);
    });

    it('survives an empty dataset', () => {
      expect(capIndicesForFreeExport(null, 0)).toEqual([]);
    });
  });

  describe('when a filter is active', () => {
    it('takes the first rows of the filtered view, not of the dataset', () => {
      const filtered = [42, 7, 900, 13];

      expect(capIndicesForFreeExport(filtered, 1000)).toEqual([42, 7, 900, 13]);
    });

    it('caps a long filtered view', () => {
      const filtered = Array.from({ length: 50 }, (_, i) => i * 3);

      expect(capIndicesForFreeExport(filtered, 1000)).toHaveLength(FREE_EXPORT_ROWS);
      expect(capIndicesForFreeExport(filtered, 1000)[0]).toBe(0);
      expect(capIndicesForFreeExport(filtered, 1000)[9]).toBe(27);
    });

    it('does not mutate the caller-owned index array', () => {
      const filtered = Array.from({ length: 50 }, (_, i) => i);

      capIndicesForFreeExport(filtered, 1000);

      expect(filtered).toHaveLength(50);
    });
  });

  // This decides two things at once: whether the file is a sample, and whether
  // the buyer is shown a paywall afterwards. A view small enough to hand over
  // whole has nothing left to sell, and pitching one anyway would be a lie
  // about a file the reader can open and count.
  describe('whether the file is a sample at all', () => {
    it('sells only once the list is several times the free slice', () => {
      // Not "anything over the allowance". At eleven rows the offer is two rows
      // for $7, about a file the reader is holding — the same lie this function
      // prevents at ten, one step to the right.
      expect(PAYWALL_MIN_ROWS).toBe(FREE_EXPORT_ROWS * PAYWALL_MIN_RATIO);
      expect(PAYWALL_MIN_ROWS).toBe(30);
    });

    it('is capped once the view passes the selling threshold', () => {
      expect(isFreeExportCapped(null, PAYWALL_MIN_ROWS + 1)).toBe(true);
      expect(isFreeExportCapped(range(PAYWALL_MIN_ROWS + 1), 5000)).toBe(true);
    });

    it('is complete at exactly the threshold', () => {
      // Pins the boundary against a `>=` mutation, which would start pitching
      // the reader whose whole list is thirty rows.
      expect(isFreeExportCapped(null, PAYWALL_MIN_ROWS)).toBe(false);
      expect(isFreeExportCapped(range(PAYWALL_MIN_ROWS), 5000)).toBe(false);
    });

    it('is complete for a view that merely exceeds the free slice', () => {
      // The case the threshold exists for. Under the old rule both of these
      // opened a paywall.
      expect(isFreeExportCapped(null, FREE_EXPORT_ROWS + 1)).toBe(false);
      expect(isFreeExportCapped(range(25), 5000)).toBe(false);
    });

    it('is complete when the view is smaller', () => {
      expect(isFreeExportCapped([4, 8], 5000)).toBe(false);
      expect(isFreeExportCapped(null, 0)).toBe(false);
    });
  });

  // The two exports answer connected questions, and a caller believing one
  // while the file holds the other ships a silently wrong file: a truncated
  // download named `-sample` with no paywall to explain why it stops.
  describe('the file agrees with the pitch', () => {
    it('hands over every row of a view it will not sell against', () => {
      expect(capIndicesForFreeExport(null, 25)).toHaveLength(25);
      expect(capIndicesForFreeExport(range(25), 5000)).toHaveLength(25);
    });

    it('hands over the whole view at exactly the threshold', () => {
      expect(capIndicesForFreeExport(null, PAYWALL_MIN_ROWS)).toHaveLength(PAYWALL_MIN_ROWS);
    });

    it('cuts to the free slice as soon as it does sell', () => {
      expect(capIndicesForFreeExport(null, PAYWALL_MIN_ROWS + 1)).toHaveLength(FREE_EXPORT_ROWS);
    });

    it('never truncates a view without also pitching it', () => {
      // The invariant, swept rather than sampled: a shorter file than the view
      // is exactly the set of cases that get a paywall.
      for (const size of [0, 1, 9, 10, 11, 25, 29, 30, 31, 100]) {
        const wasCut = capIndicesForFreeExport(null, size).length < size;

        expect(wasCut, `view of ${size}`).toBe(isFreeExportCapped(null, size));
      }
    });
  });
});

/** A filtered view of `size` rows, with indices that are not 0..n-1. */
function range(size: number): number[] {
  return Array.from({ length: size }, (_, index) => index * 3);
}
