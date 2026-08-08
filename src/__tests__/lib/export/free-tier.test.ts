import { describe, expect, it } from 'vitest';

import {
  FREE_EXPORT_ROWS,
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
  // the buyer is shown a paywall afterwards. A view that fits under the cap has
  // nothing left to sell, and pitching one anyway would be a lie about a file
  // the reader can open and count.
  describe('whether the file is a sample at all', () => {
    it('is capped when the view is larger than the free allowance', () => {
      expect(isFreeExportCapped(null, 11)).toBe(true);
      expect(isFreeExportCapped([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 5000)).toBe(true);
    });

    it('is complete when the view fits exactly', () => {
      expect(isFreeExportCapped(null, FREE_EXPORT_ROWS)).toBe(false);
    });

    it('is complete when the view is smaller', () => {
      expect(isFreeExportCapped([4, 8], 5000)).toBe(false);
      expect(isFreeExportCapped(null, 0)).toBe(false);
    });
  });
});
