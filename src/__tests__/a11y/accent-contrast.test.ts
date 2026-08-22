/**
 * Guards `--accent` as what its only consumers actually use it for: a neutral
 * *state* surface — hover on the outline and ghost buttons and the outline
 * badge, open on the dialog close control. Nothing paints it decoratively.
 *
 * It used to be the brand violet, brighter and almost twice the chroma of
 * `--primary` (dark: oklch(0.7 0.2 285) against the CTA's oklch(0.65 0.16 264)).
 * The consequence was a hierarchy defect rather than a contrast one: the ghost
 * "Not now" on the paywall composited to #4d4684 on hover and read as a second
 * primary button, at the moment the cursor was on the decision. Both themes now
 * take the values `--sidebar-accent` already carried — the same token for the
 * sidebar, neutral there since it was written.
 *
 * Two invariants below, and the second one replaced its own opposite. The old
 * test pinned "foreground darker than accent, in both themes", which held only
 * because a saturated mid-tone accent is a light surface in *either* theme. A
 * neutral accent belongs to its own theme's end of the scale, so the pairing
 * direction is now theme-dependent by design, and what is worth pinning is that
 * accent stays near its background rather than which side the text sits on.
 *
 * The partial-alpha case (`dark:hover:bg-accent/50`) is still guarded in
 * components/ui/button.test.tsx and is no longer in tension with this file:
 * flat and composited accent now sit on the same side of the page.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { contrastRatio, readThemeTokens, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

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

  it('keeps accent a near-neutral, so a state surface never outranks the CTA', () => {
    // Chroma read from the token text, not from the parsed sRGB triple: the
    // defect this pins is saturation, and sRGB cannot say how saturated a
    // colour was meant to be. --primary is the reference because outranking it
    // is the failure mode — a hover surface may not carry more colour than the
    // button that takes the payment.
    const chroma = (theme: 'light' | 'dark', name: string) => {
      const raw = readThemeTokens(theme)[name];
      const m = raw?.match(/oklch\(\s*[\d.]+\s+([\d.]+)/);
      if (!m) throw new Error(`${name} is not an oklch() in ${theme}: ${raw}`);
      return parseFloat(m[1]);
    };

    for (const theme of ['light', 'dark'] as const) {
      expect(chroma(theme, '--accent')).toBeLessThan(chroma(theme, '--primary'));
      expect(chroma(theme, '--accent')).toBeLessThanOrEqual(0.05);
    }
  });

  it('keeps accent on its own theme\u2019s side of the scale, not a mid-tone in both', () => {
    // The direction that replaced "foreground darker than accent". A state
    // surface is a lift off the page, so it must stay near the background and
    // far from the foreground — which is what makes the text pairing flip
    // between themes instead of being fixed.
    for (const theme of ['light', 'dark'] as const) {
      const toBackground = contrastRatio(token(theme, '--accent'), token(theme, '--background'));
      const toForeground = contrastRatio(token(theme, '--accent'), token(theme, '--foreground'));
      expect(toBackground).toBeLessThan(2);
      expect(toForeground).toBeGreaterThan(toBackground);
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
