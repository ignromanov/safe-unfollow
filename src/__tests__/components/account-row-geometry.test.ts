import { estimateRowHeight } from '@/components/account-row-geometry';

describe('estimateRowHeight', () => {
  it.each([
    [false, false, 85],
    [true, false, 105],
    [false, true, 113],
    [true, true, 133],
  ])('reserve=%s desktop=%s → %i', (reserveDateLine, desktop, height) => {
    expect(estimateRowHeight({ reserveDateLine, desktop })).toBe(height);
  });

  it("desktop plain row exceeds the old fixed 92 by GH#107's 21px", () => {
    expect(estimateRowHeight({ reserveDateLine: false, desktop: true }) - 92).toBe(21);
  });
});
