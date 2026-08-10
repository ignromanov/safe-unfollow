/**
 * WCAG contrast helpers for the OKLCH design tokens in `src/styles.css`.
 *
 * These exist because jsdom computes no colour and no layout: a test can assert
 * which class an element carries, but nothing in the suite can tell whether the
 * pair of tokens behind those classes is actually legible. Reading the tokens
 * out of the stylesheet and doing the arithmetic here closes that gap, and — more
 * usefully — guards the *invariant* (>= 4.5:1) rather than one particular hex, so
 * a future change to `--primary` is caught as well as a change to its foreground.
 *
 * Conversion follows CSS Color 4 (oklab matrices); luminance follows WCAG 2.1.
 * Out-of-gamut tokens are clipped per channel rather than chroma-mapped. That is
 * an approximation, but it was checked against chroma reduction for every pair
 * asserted here and the two methods never disagree on a pass/fail verdict.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Rgb = readonly [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const encodeGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const decodeGamma = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** `oklch(L C H)` -> displayed sRGB, each channel 0..1. */
export function oklchToRgb(L: number, C: number, H: number): Rgb {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map(c => clamp01(encodeGamma(clamp01(c)))) as unknown as Rgb;
}

/** Parses an `oklch(L C H)` / `oklch(L C H / A)` declaration value. */
export function parseOklch(value: string): Rgb {
  const match = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i
  );
  if (!match) throw new Error(`not an oklch() value: ${value}`);
  return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Composites `fg` at `alpha` over `bg`, the way a `/NN` opacity utility does. */
export function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as unknown as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(decodeGamma);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1..21. */
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const STYLES_PATH = resolve(process.cwd(), 'src/styles.css');

/**
 * Reads the custom properties of one theme out of `src/styles.css`.
 * `light` is the `:root` block, `dark` is the `.dark` block.
 */
export function readThemeTokens(theme: 'light' | 'dark'): Record<string, string> {
  const css = readFileSync(STYLES_PATH, 'utf8');
  const darkStart = css.indexOf('.dark {');
  if (darkStart === -1) throw new Error('no .dark block in src/styles.css');

  const rootStart = css.indexOf(':root {');
  if (rootStart === -1) throw new Error('no :root block in src/styles.css');

  const block =
    theme === 'dark'
      ? css.slice(darkStart, css.indexOf('}', darkStart))
      : css.slice(rootStart, css.indexOf('}', rootStart));

  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Convenience: one token of one theme, already converted to sRGB. */
export function token(theme: 'light' | 'dark', name: string): Rgb {
  const value = readThemeTokens(theme)[name];
  if (!value) throw new Error(`token ${name} not found in ${theme} theme`);
  return parseOklch(value);
}

export const WCAG_AA_NORMAL = 4.5;
