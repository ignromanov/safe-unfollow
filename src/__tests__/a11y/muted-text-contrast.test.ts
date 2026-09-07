/**
 * Guards the secondary text on the intent landing pages.
 *
 * These pages shipped their captions, counts and footnotes in `text-zinc-500`, a hand-picked
 * grey that nothing measures. On the dark theme it renders at 4.20:1 against the page
 * background and 3.67:1 against a card — both below AA — and jsdom computes no colour, so the
 * whole suite was green over it. `--muted-foreground` is the token the app already defines for
 * exactly this role, and the arithmetic below is what makes reaching for it safe rather than
 * merely tidy.
 *
 * The invariant guarded is legibility on the surfaces this text actually sits on, not the
 * identity of any one utility class: a future change to `--muted-foreground`, `--card` or
 * `--muted` fails here too.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, over, token, WCAG_AA_NORMAL, type Rgb } from '@tests/utils/contrast';

const THEMES = ['light', 'dark'] as const;

/** Tailwind's `zinc-500`, the colour these pages used to carry. Only ever used as a control. */
const ZINC_500: Rgb = [113 / 255, 113 / 255, 122 / 255];

describe('--muted-foreground on the surfaces the intent pages use', () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      // --background is the page; --card is the preview panel; the footnote inside that panel
      // sits on `bg-muted/40`, which is --muted composited over --card.
      const surfaces: Array<[string, (t: typeof theme) => Rgb]> = [
        ['--background', t => token(t, '--background')],
        ['--card', t => token(t, '--card')],
        ['bg-muted/40 over --card', t => over(token(t, '--muted'), 0.4, token(t, '--card'))],
      ];

      for (const [name, surface] of surfaces) {
        it(`stays at 4.5:1 or better on ${name}`, () => {
          const ratio = contrastRatio(token(theme, '--muted-foreground'), surface(theme));
          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
        });
      }
    });
  }

  // The control. Without it every assertion above could be passing because the arithmetic
  // cannot produce a failure, and the suite would read as proof of a property it never tested.
  // This is the measurement that sent the page to the token in the first place; if it ever
  // stops failing, the helper has changed underneath these tests and they mean nothing.
  it('would fail on the zinc-500 these pages used to carry', () => {
    expect(contrastRatio(ZINC_500, token('dark', '--card'))).toBeLessThan(WCAG_AA_NORMAL);
    expect(contrastRatio(ZINC_500, token('dark', '--background'))).toBeLessThan(WCAG_AA_NORMAL);
  });
});

/**
 * The page source with comments removed.
 *
 * Written after the first version of the sweep below went red on the comment that explains why
 * the colour was removed — a sweep for a forbidden class must read code, not prose about the
 * code, or documenting a fix becomes indistinguishable from committing it.
 */
function intentPageCode(): string {
  return readFileSync(resolve(process.cwd(), 'src/pages/IntentPage.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('IntentPage keeps its secondary text on the measured token', () => {
  // A source sweep, because the arithmetic above proves the token is safe and proves nothing
  // about whether the page uses it. Scoped to this one file rather than to src/: the greys
  // elsewhere sit on surfaces this suite has not measured, and a repo-wide ban would be a
  // claim about pairings nobody here has checked.
  it('names no text-zinc-500 for muted text', () => {
    const offenders = intentPageCode()
      .split('\n')
      .map((line, i) => [line, i + 1] as const)
      .filter(([line]) => /\btext-zinc-500\b/.test(line))
      .map(([, n]) => `src/pages/IntentPage.tsx:${n}`);

    expect(offenders).toEqual([]);
  });

  // text-zinc-400 stays, and this is the measurement rather than a waiver. It colours the User
  // glyph inside the avatar well, copied verbatim from AccountItem.tsx:45 so the preview shows
  // the row the reader is actually about to get. On the light well it measures 2.32:1, which
  // would be a defect for text — the glyph is aria-hidden decoration beside the @handle that
  // carries the same information, so 1.4.3 and 1.4.11 both exempt it. Recorded so the next
  // reader finds the reasoning instead of the ratio.
  it('keeps its raw grey only on the aria-hidden avatar glyph', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/IntentPage.tsx'), 'utf8');
    const greyLines = source.split('\n').filter(line => /\btext-zinc-400\b/.test(line));

    expect(greyLines).toHaveLength(1);
    expect(greyLines[0]).toContain('rounded-2xl');
    expect(source).toContain('<User size={22} aria-hidden="true" />');
  });

  it('uses --muted-foreground for it instead', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/IntentPage.tsx'), 'utf8');
    expect(source).toContain('text-muted-foreground');
  });
});
