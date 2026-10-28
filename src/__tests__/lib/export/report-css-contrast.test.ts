import { describe, expect, it } from 'vitest';

import { REPORT_CSS } from '@/lib/export/report-markup';

type Tokens = Record<string, string>;

const MIN = 4.5;

function parseTokens(block: string): Tokens {
  const tokens: Tokens = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)) {
    tokens[m[1] as string] = m[2] as string;
  }
  return tokens;
}

const lightBlock = /^:root\{([^}]*)\}/m.exec(REPORT_CSS)?.[1] ?? '';
const darkBlock =
  /@media \(prefers-color-scheme:dark\)\{:root\{([^}]*)\}/.exec(REPORT_CSS)?.[1] ?? '';

const light = parseTokens(lightBlock);
const dark = { ...light, ...parseTokens(darkBlock) };
const themes: [string, Tokens][] = [
  ['light', light],
  ['dark', dark],
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi as number) + 0.05) / ((lo as number) + 0.05);
}

function check(tokens: Tokens, pairs: [string, string][]): void {
  for (const [fg, bg] of pairs) {
    const a = tokens[fg];
    const b = tokens[bg];
    expect(a, `${fg} is defined`).toBeDefined();
    expect(b, `${bg} is defined`).toBeDefined();
    expect(ratio(a as string, b as string), `${fg} on ${bg} (${a} / ${b})`).toBeGreaterThanOrEqual(
      MIN
    );
  }
}

const PAIRS: [string, string][] = [
  ['--fg', '--bg'],
  ['--fg', '--card'],
  ['--muted', '--bg'],
  ['--muted', '--card'],
  ['--link', '--card'],
  ['--warn', '--card'],
  ['--fg', '--warn-t'],
  ['--zinc', '--zinc-t'],
];

const tonePairs = (tokens: Tokens): [string, string][] =>
  Object.keys(tokens)
    .map(k => /^--(\w+)-t$/.exec(k)?.[1])
    .filter((n): n is string => n !== undefined)
    .flatMap((n): [string, string][] => [
      [`--${n}`, `--${n}-t`],
      [`--${n}`, '--card'],
    ]);

function ruleFor(css: string, sel: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] as string).split(',').some(x => x.trim() === sel)) return m[2] as string;
  }
  return '';
}

describe('REPORT_CSS contrast', () => {
  it.each(themes)('%s: every listed pair clears 4.5:1', (_name, tokens) => {
    check(tokens, PAIRS);
  });

  it.each(themes)('%s: every tone clears 4.5:1 on its own tint and on --card', (_name, tokens) => {
    check(tokens, tonePairs(tokens));
  });

  it('white clears 4.5:1 on both CTA stops', () => {
    for (const stop of ['--cta1', '--cta2']) {
      const bg = light[stop];
      expect(bg, `${stop} is defined`).toBeDefined();
      expect(ratio('#ffffff', bg as string), stop).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('derives at least four tone pairs', () => {
    expect(tonePairs(light).length).toBeGreaterThanOrEqual(8);
    expect(tonePairs(dark).length).toBeGreaterThanOrEqual(8);
  });

  it('isolates usernames as LTR, linked or not', () => {
    for (const sel of ['.row a', '.row .u']) {
      expect(ruleFor(REPORT_CSS, sel), sel).toMatch(/direction:ltr;?.*unicode-bidi:isolate/);
    }
  });
});
