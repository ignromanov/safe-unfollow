/**
 * Guards the pairing of `--accent-foreground` with `--accent`.
 *
 * Light paired a near-white foreground with the vivid purple accent at 3.50:1,
 * below AA; dark already paired near-black with its accent and cleared at
 * 6.88:1. Same shape as the `--primary` defect fixed alongside it — light was
 * the outlier, so light moved.
 *
 * The token is only correct on a *flat* `--accent` fill. Where accent is
 * composited at partial alpha over a dark page (`dark:hover:bg-accent/50`, the
 * ghost button) the surface stays dark and this token is the wrong answer —
 * that case is guarded in components/ui/button.test.tsx, and the split is the
 * reason the token flip alone did not close the defect.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { contrastRatio, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

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

describe('text on a flat --accent meets WCAG AA', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: --accent-foreground on --accent clears 4.5:1`, () => {
      const ratio = contrastRatio(token(theme, '--accent-foreground'), token(theme, '--accent'));
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }

  it('keeps the foreground darker than the accent it sits on, in both themes', () => {
    // Pins the direction rather than a hex. --accent is a saturated mid-tone in
    // both themes, so the legible pairing is a dark foreground either way —
    // which is exactly what the light theme got wrong.
    const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    for (const theme of ['light', 'dark'] as const) {
      expect(lum(token(theme, '--accent-foreground'))).toBeLessThan(lum(token(theme, '--accent')));
    }
  });
});

describe('no component paints a literal white on an accent surface', () => {
  // Accent fills only ever appear as hover/state utilities in the ui/ variants,
  // so surface and colour always share a line here — unlike the --primary sweep,
  // which had to concede StatCard. Kept anyway: it costs nothing and the next
  // accent-tinted surface someone adds is the one worth catching.
  it('has no line pairing an accent fill with text-white', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!/\bbg-accent\b|\bbg-accent\//.test(line)) return;
          if (!/(?<!dark:)\btext-white\b/.test(line)) return;
          offenders.push(`${relative(SRC, file)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
