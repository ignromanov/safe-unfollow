/**
 * Guards the pairing of `--primary-foreground` with `--primary`.
 *
 * Before this suite existed the light theme paired a near-white foreground with
 * the brand blue at 3.95:1 — below WCAG AA — and three components bypassed the
 * token entirely with a literal `text-white`, which failed in dark mode too
 * (3.30:1). Nothing in the suite could see either problem, because jsdom
 * computes no colour.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { contrastRatio, over, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('text on --primary meets WCAG AA', () => {
  // The `/90` hover blends the fill toward whatever sits behind it. --background
  // and --card are the two surfaces a primary button actually sits on here.
  const surfaces = ['--background', '--card'] as const;

  for (const theme of ['light', 'dark'] as const) {
    describe(theme, () => {
      it('pairs --primary-foreground with --primary at 4.5:1 or better', () => {
        const ratio = contrastRatio(
          token(theme, '--primary-foreground'),
          token(theme, '--primary')
        );
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });

      for (const surface of surfaces) {
        it(`holds AA on hover:bg-primary/90 over ${surface}`, () => {
          const blended = over(token(theme, '--primary'), 0.9, token(theme, surface));
          const ratio = contrastRatio(token(theme, '--primary-foreground'), blended);
          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
        });
      }

      it('keeps the StatCard sublabel legible at /90 opacity', () => {
        const primary = token(theme, '--primary');
        const faded = over(token(theme, '--primary-foreground'), 0.9, primary);
        // /80 — the opacity this label used to carry — measures 4.13:1 in light
        // and fails. /90 is the deepest fade that still clears AA in both themes.
        expect(contrastRatio(faded, primary)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });

      it('keeps the bg-white/20 count pill legible', () => {
        const pill = over([1, 1, 1], 0.2, token(theme, '--primary'));
        const ratio = contrastRatio(token(theme, '--primary-foreground'), pill);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    });
  }

  it('would fail if a near-white foreground came back to the light theme', () => {
    // Pins the direction of the fix rather than the exact value: whatever
    // --primary-foreground becomes, it must be darker than its own --primary,
    // which is what makes the /90 hover *improve* instead of degrade.
    const fg = token('light', '--primary-foreground');
    const bg = token('light', '--primary');
    const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    expect(lum(fg)).toBeLessThan(lum(bg));
  });
});

describe('no component paints a literal white on --primary', () => {
  // A text sweep, not a render sweep. It catches every case where the surface
  // and the colour sit on one line, which is how 24 of the 26 original defects
  // were written. It cannot see StatCard, whose `bg-primary` is eight lines
  // above its label colour — that one is guarded by a render assertion in
  // StatCard.test.tsx, and the same is true for FilterChips.
  it('has no line pairing bg-primary with text-white', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!line.includes('bg-primary')) return;
          // `dark:text-white` is a page-background heading colour, not a fill.
          if (!/(?<!dark:)\btext-white\b/.test(line)) return;
          offenders.push(`${relative(SRC, file)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
