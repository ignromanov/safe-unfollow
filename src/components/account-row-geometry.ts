// Derived from AccountItem's classes, not measured; the four values are pinned against a real
// layout by the owner-device check, because jsdom has none.
const ROW = { mobile: 85, desktop: 113 } as const;
const DATE_LINE = 20; // mt-1 (4) + h-4 (16)

export function estimateRowHeight({
  reserveDateLine,
  desktop,
}: {
  reserveDateLine: boolean;
  desktop: boolean;
}): number {
  const base = desktop ? ROW.desktop : ROW.mobile;
  return reserveDateLine ? base + DATE_LINE : base;
}
