// Measured in a real browser, and matching AccountItem's classes:
// - mobile: py-4 (32) + text column (52) = 84
// - desktop: py-6 (48) + text column (64) = 112
// - reserved date line: +20 (mt-1 4 + h-4 16)
// There is no border-b: each row sits alone in its virtual wrapper, so last:border-0 removes it.
const ROW = { mobile: 84, desktop: 112 } as const;
const DATE_LINE = 20;

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
