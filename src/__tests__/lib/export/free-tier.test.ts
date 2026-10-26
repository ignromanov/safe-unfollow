import { describe, expect, it } from 'vitest';

import {
  FREE_EXPORT_ROWS,
  PAYWALL_MIN_RATIO,
  PAYWALL_MIN_ROWS,
  freeReportSampleLimit,
  isFreeExportCapped,
} from '@/lib/export/free-tier';

describe('free export cap', () => {
  it('hands over a fixed number of rows, not a share of the list', () => {
    // A percentage would give an influencer thousands of rows free and a casual
    // user four. Every reviewed product (PhantomBuster, Hunter.io, ZoomInfo)
    // caps on an absolute count for the same reason.
    expect(FREE_EXPORT_ROWS).toBe(10);
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

  // The sample limit and the paywall answer connected questions, and a caller
  // believing one while the file holds the other ships a silently wrong file: a
  // report that stops at ten rows with no paywall to explain why, or a complete
  // one named `-sample`.
  describe('the report agrees with the pitch', () => {
    it('limits the report to the free slice exactly when it sells', () => {
      // Swept rather than sampled, over both view shapes.
      for (const size of [0, 1, 9, 10, 11, 25, 29, 30, 31, 100, 1_000_000]) {
        const capped = isFreeExportCapped(null, size);

        expect(freeReportSampleLimit(null, size), `all ${size}`).toBe(
          capped ? FREE_EXPORT_ROWS : null
        );
      }
      for (const size of [0, 10, 30, 31]) {
        const view = range(size);
        const capped = isFreeExportCapped(view, 5000);

        expect(freeReportSampleLimit(view, 5000), `filtered ${size}`).toBe(
          capped ? FREE_EXPORT_ROWS : null
        );
      }
    });

    it('hands over the whole view at exactly the threshold', () => {
      expect(freeReportSampleLimit(null, PAYWALL_MIN_ROWS)).toBeNull();
    });

    it('limits to the free slice as soon as it does sell', () => {
      expect(freeReportSampleLimit(null, PAYWALL_MIN_ROWS + 1)).toBe(FREE_EXPORT_ROWS);
    });

    it('reads the filtered view, not the dataset, when a filter is active', () => {
      // A dataset of thousands seen through a three-row filter is a complete file.
      expect(freeReportSampleLimit([4, 8, 15], 5000)).toBeNull();
    });
  });
});

/** A filtered view of `size` rows, with indices that are not 0..n-1. */
function range(size: number): number[] {
  return Array.from({ length: size }, (_, index) => index * 3);
}
