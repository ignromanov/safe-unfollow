/**
 * Resolves the colour a Tailwind utility actually paints, for the contrast gates.
 *
 * Extracted verbatim from `a11y/results-surface-contrast.test.ts`, which was the
 * only consumer until `a11y/badge-chip-contrast.test.ts` needed the same three
 * shapes. Copying it would have put the same arithmetic in two files, and the
 * one that nobody edits is the one that goes stale — the defect `CLAUDE.md`
 * calls "no copied facts", one directory over.
 *
 * Three shapes resolve, in this order:
 *   1. an arbitrary value, `text-[oklch(0.6_0.2_25)]`
 *   2. a third-party palette step, `text-rose-600`, read out of the installed
 *      `tailwindcss/theme.css` rather than copied from it
 *   3. one of our own tokens, `text-card-foreground`, read live out of
 *      `src/styles.css`
 *
 * Nothing here hardcodes a colour. A palette bump that re-tunes `rose-600`, or a
 * change to `--card`, moves what these functions return — which is the whole
 * reason the gates that use them are worth running.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { oklchToRgb, readThemeTokens, token, type Rgb } from './contrast';

export type Theme = 'light' | 'dark';
export const THEMES: readonly Theme[] = ['light', 'dark'] as const;

const TAILWIND_THEME_PATH = resolve(process.cwd(), 'node_modules/tailwindcss/theme.css');
const TAILWIND_THEME_CSS = readFileSync(TAILWIND_THEME_PATH, 'utf8');

/**
 * One Tailwind palette step, read out of the installed dependency rather than
 * copied from it. Its own declarations are percentage-L (`oklch(58.6% 0.253
 * 17.585)`) and may carry `none` for an achromatic hue.
 *
 * Throws when the step is absent or no longer an `oklch()` — a palette a gate
 * cannot read is an unmeasured colour, and a bump that changes the notation must
 * stop the suite rather than quietly keep the old numbers.
 */
export function paletteColour(step: string): Rgb {
  const declaration = new RegExp(
    `--color-${step}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+|none)\\s*\\)`
  );
  const m = TAILWIND_THEME_CSS.match(declaration);
  if (!m) throw new Error(`--color-${step} not readable as oklch() in ${TAILWIND_THEME_PATH}`);
  return oklchToRgb(Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3]));
}

/** True when the installed Tailwind declares this palette step. */
export function isPaletteStep(step: string): boolean {
  return new RegExp(`--color-${step}:`).test(TAILWIND_THEME_CSS);
}

/** `oklch(L C H)` / `oklch(L_C_H_/_A)` — Tailwind escapes its spaces as `_`. */
const OKLCH = /oklch\(\s*([\d.]+)[\s_]+([\d.]+)[\s_]+([\d.]+)(?:[\s_]*\/[\s_]*([\d.]+))?\s*\)/i;

export interface Tint {
  readonly lch: readonly [number, number, number];
  readonly rgb: Rgb;
  readonly alpha: number;
}

export function parseOklchTint(value: string): Tint {
  const m = value.match(OKLCH);
  if (!m) throw new Error(`not an oklch() value: ${value}`);
  const lch = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  return { lch, rgb: oklchToRgb(...lch), alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

/**
 * One Tailwind utility's colour, or `null` when the utility names no colour
 * (`text-xs`, `rounded-full`, ...).
 */
export function resolveColour(utility: string, theme: Theme): Tint | null {
  if (utility.startsWith('[') && utility.endsWith(']')) {
    return parseOklchTint(utility.slice(1, -1).replace(/_/g, ' '));
  }
  if (isPaletteStep(utility)) {
    return { lch: [NaN, NaN, NaN], rgb: paletteColour(utility), alpha: 1 };
  }
  if (`--${utility}` in readThemeTokens(theme)) {
    return { lch: [NaN, NaN, NaN], rgb: token(theme, `--${utility}`), alpha: 1 };
  }
  return null;
}

/**
 * The colour a `prefix-` utility actually paints in `theme`, taken from the
 * element's own class list. `dark:` wins in dark. Throws rather than returning
 * null when nothing resolves: a colour we cannot resolve is an unmeasured
 * colour, and a gate must not go quiet when its subject moves out from under it.
 */
export function paintedColour(className: string, prefix: 'text-' | 'bg-', theme: Theme): Tint {
  const classes = className.split(/\s+/).filter(Boolean);
  const pick = (list: string[]) => {
    for (const utility of list) {
      const colour = resolveColour(utility, theme);
      if (colour) return colour;
    }
    return null;
  };

  const dark = pick(
    classes.filter(c => c.startsWith(`dark:${prefix}`)).map(c => c.slice(`dark:${prefix}`.length))
  );
  const base = pick(classes.filter(c => c.startsWith(prefix)).map(c => c.slice(prefix.length)));

  const painted = theme === 'dark' ? (dark ?? base) : base;
  if (!painted) throw new Error(`no ${prefix} colour resolved in ${theme} from: ${className}`);
  return painted;
}
