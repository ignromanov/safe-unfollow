/**
 * Guards `--accent` as what its only consumers actually use it for: a neutral
 * *state* surface — hover on the outline and ghost buttons and the outline
 * badge, open on the dialog close control. Nothing paints it decoratively.
 *
 * It used to be the brand violet, brighter and almost twice the chroma of
 * `--primary` (dark: oklch(0.7 0.2 285) against the CTA's oklch(0.65 0.16 264)).
 * The consequence was a hierarchy defect rather than a contrast one: the ghost
 * "Not now" on the paywall composited to #4d4684 on hover and read as a second
 * primary button, at the moment the cursor was on the decision. Both themes
 * started from the values `--sidebar-accent` already carried — the same token
 * for the sidebar, neutral there since it was written.
 *
 * That first fix overshot in the other direction: measured against Material
 * Design's 8% hover state-layer standard, dark `--accent` at `--sidebar-accent`'s
 * lightness (0.25) fell under the floor as a flat surface on `--card` (1.175 vs.
 * a required 1.2185). Dark `--accent` is now 0.28 — no longer tied to
 * `--sidebar-accent`/`--input`/`--border`, which stay at 0.25 — and the
 * `dark:hover:bg-accent/50` override that used to soften the violet is gone
 * from `ghost`, since against a neutral token the alpha was the thing pushing
 * the hover back under the floor. See "dark hover clears the Material Design
 * 8% state-layer floor" below for the guard, and "light --accent is exempt
 * from that floor" for why light does not take the same fix.
 *
 * Two invariants below, and the second one replaced its own opposite. The old
 * test pinned "foreground darker than accent, in both themes", which held only
 * because a saturated mid-tone accent is a light surface in *either* theme. A
 * neutral accent belongs to its own theme's end of the scale, so the pairing
 * direction is now theme-dependent by design, and what is worth pinning is that
 * accent stays near its background rather than which side the text sits on.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  contrastRatio,
  over,
  readThemeTokens,
  token,
  WCAG_AA_NORMAL,
  type Rgb,
} from '@tests/utils/contrast';

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

describe('dark hover clears the Material Design 8% state-layer floor', () => {
  /**
   * Flat `--accent` is now what every dark hover surface actually is
   * (`ghost`/`outline` share `--input`'s lightness family, `dialog`'s
   * close control uses it directly) — but nothing here measured whether
   * that lift is *visible* as a hover, only whether text on it is legible.
   * MD's state-layer standard expresses "visibly a state change" as an 8%
   * overlay of the surface's own contrasting colour (white on a dark
   * surface) composited over that surface, then read back as a contrast
   * ratio against the un-lifted surface. That is the floor computed below,
   * from the surfaces themselves rather than hardcoded, so it tracks
   * `--background`/`--card` if they move rather than pinning today's
   * numbers (measured 2026-08-22: 1.1621 on --background, 1.2185 on
   * --card — the card figure is the binding one, since the paywall dialog
   * sits on a card).
   */
  const STATE_LAYER_OVERLAY: Rgb = [1, 1, 1];
  const STATE_LAYER_ALPHA = 0.08;

  for (const surfaceName of ['--background', '--card'] as const) {
    it(`flat --accent hover over ${surfaceName} is at least as visible as an 8% white overlay`, () => {
      const surface = token('dark', surfaceName);
      const floor = contrastRatio(over(STATE_LAYER_OVERLAY, STATE_LAYER_ALPHA, surface), surface);
      const accentLift = contrastRatio(token('dark', '--accent'), surface);
      expect(accentLift).toBeGreaterThanOrEqual(floor);
    });
  }
});

describe('light --accent is exempt from that floor, and the exemption is structural', () => {
  /**
   * Light cannot clear the MD floor with a flat neutral accent the way dark
   * now does. Reaching it requires lightening `--accent` to L <= 0.93 (the
   * light surfaces are already near-white, so an 8% overlay barely moves
   * them — the floor itself is only ~1.196–1.197 there). But light
   * `--border` sits at L 0.92, one 0.01 step below that ceiling, and at
   * L 0.92 a near-neutral accent becomes luminance-identical to `--border`
   * (contrast ratio exactly 1.000 — measured). Pushing light `--accent`
   * far enough to clear the state-layer floor would make the `outline`
   * button's border disappear into its own hover fill. The window between
   * "visible enough to clear the floor" and "indistinguishable from the
   * border" is a single token step, so this is not a tuning gap to close
   * later — it is why light stays under the floor on purpose.
   *
   * This test pins the actual constraint (accent stays visibly apart from
   * --border) rather than the absence of one, so a future attempt to
   * "fix" light by moving --accent toward --border's lightness fails here
   * with an explanation, instead of silently erasing the border.
   */
  it('keeps light --accent visibly distinct from --border', () => {
    const ratio = contrastRatio(token('light', '--accent'), token('light', '--border'));
    expect(ratio).toBeGreaterThan(1.1);
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
