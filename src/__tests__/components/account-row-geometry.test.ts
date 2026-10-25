import { estimateRowHeight } from '@/components/account-row-geometry';

describe('estimateRowHeight', () => {
  it.each([
    [false, false, 84],
    [true, false, 104],
    [false, true, 112],
    [true, true, 132],
  ])('reserve=%s desktop=%s → %i', (reserveDateLine, desktop, height) => {
    expect(estimateRowHeight({ reserveDateLine, desktop })).toBe(height);
  });

  // GH#107's table said 21px: it counted a border-b that last:border-0 removes on every row.
  it("desktop plain row exceeds the old fixed 92 by GH#107's real overflow of 20px", () => {
    expect(estimateRowHeight({ reserveDateLine: false, desktop: true }) - 92).toBe(20);
  });
});
