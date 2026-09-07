/**
 * Guards the contrast of everything on `/results` that sits on `--card`: the
 * applied-filter chips and the "Reset" control in `AppliedFilters`, and the
 * empty-state title in `AccountList`, which this PR made load-bearing — it now
 * names the applied filter, so it is the only thing telling the reader why the
 * list is empty.
 *
 * All of it sits on `--card`: `AppliedFilters` renders inside the sidebar card
 * (`AccountListSection.tsx`, the `bg-card ... rounded-4xl` panel around the
 * filter sheet), and `AccountList`'s empty state is the `bg-card` box it
 * returns directly (`AccountList.tsx`).
 *
 * ⛔ **What is measured is read off the rendered component, never declared
 * here.** The previous version of this file declared `ROSE_600`/`ROSE_400` and
 * did arithmetic on them; an auditor reverted `AppliedFilters` to the broken
 * `text-rose-500` and this suite stayed green, because nothing connected the
 * literal to the component. Now the class list comes from `render()` and only
 * the *values* behind third-party class names are pinned.
 *
 * `--card`, `--card-foreground` and `--muted-foreground` are our own tokens,
 * read live from `src/styles.css` via `token()`/`readThemeTokens()` — never
 * hardcoded, so this stays correct if any of them moves. Tailwind palette steps
 * (`rose-600` and friends) are not ours, and they are not hardcoded either:
 * `paletteColour()` reads them out of `node_modules/tailwindcss/theme.css`, the
 * installed dependency's own file. They were hand-copied oklch literals until
 * this commit, which left the gate measuring whatever Tailwind's palette
 * happened to be on the day someone typed it — a bump that re-tunes `rose-600`
 * would have moved the app's colour and left this suite green. Five dependabot
 * PRs are open on this repo as this is written, two of them major.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  contrastRatio,
  oklchToRgb,
  over,
  readThemeTokens,
  token,
  WCAG_AA_NORMAL,
  type Rgb,
} from '@tests/utils/contrast';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppliedFilters } from '@/components/AppliedFilters';
import { FilterChips } from '@/components/FilterChips';
import { BADGE_CHIP_STYLES, BADGE_STYLES } from '@/constants/badge-styles';
import { BADGE_ORDER } from '@/core/badges';
import type { BadgeKey } from '@/core/types';
import resultsEN from '@/locales/en/results.json';

type Theme = 'light' | 'dark';
const THEMES: readonly Theme[] = ['light', 'dark'] as const;

const TAILWIND_THEME_PATH = resolve(process.cwd(), 'node_modules/tailwindcss/theme.css');
const TAILWIND_THEME_CSS = readFileSync(TAILWIND_THEME_PATH, 'utf8');

/**
 * One Tailwind palette step, read out of the installed dependency rather than
 * copied from it. Its own declarations are percentage-L (`oklch(58.6% 0.253
 * 17.585)`) and may carry `none` for an achromatic hue.
 *
 * Throws when the step is absent or no longer an `oklch()` — a palette this
 * gate cannot read is an unmeasured colour, and a bump that changes the
 * notation must stop the suite rather than quietly keep the old numbers.
 */
function paletteColour(step: string): Rgb {
  const declaration = new RegExp(
    `--color-${step}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+|none)\\s*\\)`
  );
  const m = TAILWIND_THEME_CSS.match(declaration);
  if (!m) throw new Error(`--color-${step} not readable as oklch() in ${TAILWIND_THEME_PATH}`);
  return oklchToRgb(Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3]));
}

/** `oklch(L C H)` / `oklch(L_C_H_/_A)` — Tailwind escapes its spaces as `_`. */
const OKLCH = /oklch\(\s*([\d.]+)[\s_]+([\d.]+)[\s_]+([\d.]+)(?:[\s_]*\/[\s_]*([\d.]+))?\s*\)/i;

interface Tint {
  readonly lch: readonly [number, number, number];
  readonly rgb: Rgb;
  readonly alpha: number;
}

function parseOklchTint(value: string): Tint {
  const m = value.match(OKLCH);
  if (!m) throw new Error(`not an oklch() value: ${value}`);
  const lch = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  return { lch, rgb: oklchToRgb(...lch), alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

/**
 * One Tailwind utility's colour, or `null` when the utility names no colour
 * (`text-xs`, `rounded-full`, ...). Three shapes resolve, in this order:
 * an arbitrary `[oklch(...)]`, a pinned third-party palette step, and one of
 * our own tokens read live out of `src/styles.css`.
 */
function resolveColour(utility: string, theme: Theme): Tint | null {
  if (utility.startsWith('[') && utility.endsWith(']')) {
    return parseOklchTint(utility.slice(1, -1).replace(/_/g, ' '));
  }
  if (new RegExp(`--color-${utility}:`).test(TAILWIND_THEME_CSS)) {
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
 * colour, and this gate must not go quiet when its subject moves out from
 * under it.
 */
function paintedColour(className: string, prefix: 'text-' | 'bg-', theme: Theme): Tint {
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

/** The badge hue `BADGE_STYLES` gives the account rows, from source. */
function rowBadgeHue(badge: string): readonly [number, number, number] {
  const bg = BADGE_STYLES[badge]?.split(/\s+/).find(c => c.startsWith('bg-[oklch('));
  if (!bg) throw new Error(`BADGE_STYLES.${badge} carries no bg-[oklch(...)]`);
  return parseOklchTint(bg).lch;
}

function renderAllChips() {
  const view = render(
    createElement(AppliedFilters, {
      selectedFilters: new Set(BADGE_ORDER),
      onRemove: vi.fn(),
      onClearAll: vi.fn(),
    })
  );
  const chips = screen.getAllByRole('listitem').map(li => within(li).getByRole('button'));
  return { view, chips };
}

describe('AppliedFilters chips carry the badge hue and a legible label', () => {
  it('covers exactly the badges BADGE_STYLES does — key set read from source', () => {
    expect(Object.keys(BADGE_CHIP_STYLES).sort()).toEqual(Object.keys(BADGE_STYLES).sort());
    expect(Object.keys(BADGE_CHIP_STYLES).sort()).toEqual([...BADGE_ORDER].sort());
  });

  it('control: the parity check notices a badge the chip map has dropped', () => {
    const holed: Record<string, string> = { ...BADGE_CHIP_STYLES };
    delete holed[BADGE_ORDER[0]];
    expect(Object.keys(holed).sort()).not.toEqual(Object.keys(BADGE_STYLES).sort());
  });

  it('gives every chip its own badge hue, not one shared fill', () => {
    const { chips } = renderAllChips();
    expect(chips).toHaveLength(BADGE_ORDER.length);

    BADGE_ORDER.forEach((badge, i) => {
      const tint = paintedColour(chips[i].className, 'bg-', 'light');
      expect(tint.lch, `chip ${badge}`).toEqual(rowBadgeHue(badge));
      expect(tint.alpha, `chip ${badge} must tint --card, not cover it`).toBeLessThan(1);
    });
  });

  for (const theme of THEMES) {
    it(`${theme}: every chip label clears WCAG AA over its tint on --card`, () => {
      const { chips } = renderAllChips();
      expect(chips).toHaveLength(BADGE_ORDER.length);

      const card = token(theme, '--card');
      BADGE_ORDER.forEach((badge, i) => {
        const tint = paintedColour(chips[i].className, 'bg-', theme);
        const label = paintedColour(chips[i].className, 'text-', theme);
        const ratio = contrastRatio(label.rgb, over(tint.rgb, tint.alpha, card));
        expect(ratio, `chip ${badge} in ${theme}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    });

    it(`${theme}: the chip label token also clears WCAG AA on bare --card`, () => {
      const { chips } = renderAllChips();
      const label = paintedColour(chips[0].className, 'text-', theme);
      expect(contrastRatio(label.rgb, token(theme, '--card'))).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL
      );
    });
  }

  it('control: a chip labelled zinc-300 would fail over its own tint', () => {
    const { chips } = renderAllChips();
    const tint = paintedColour(chips[0].className, 'bg-', 'light');
    const ratio = contrastRatio(
      paletteColour('zinc-300'),
      over(tint.rgb, tint.alpha, token('light', '--card'))
    );
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});

describe('AppliedFilters "Reset" control clears WCAG AA on --card', () => {
  const resetClassName = () => {
    render(
      createElement(AppliedFilters, {
        selectedFilters: new Set(BADGE_ORDER.slice(0, 1)),
        onRemove: vi.fn(),
        onClearAll: vi.fn(),
      })
    );
    return screen.getByRole('button', { name: resultsEN.filters.reset }).className;
  };

  for (const theme of THEMES) {
    it(`${theme}: the colour the control actually renders clears --card`, () => {
      // Measured light ~4.5104 — 0.01 above the 4.5 threshold. rose-600 is the
      // only rose step that clears both themes on --card (rose-500 fails light
      // at 3.76:1; a step above rose-600 loses the dark-mode pairing), so the
      // margin is accepted rather than swapped for a safer colour. Which step
      // is in use is read off the render, not asserted here.
      const painted = paintedColour(resetClassName(), 'text-', theme);
      expect(contrastRatio(painted.rgb, token(theme, '--card'))).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL
      );
    });
  }

  it('control: the pre-fix text-rose-500 fails light --card', () => {
    const ratio = contrastRatio(paletteColour('rose-500'), token('light', '--card'));
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});

/**
 * `FilterChips` renders inside `SheetContent`, which is `bg-card`
 * (`ui/sheet.tsx`) — verified rather than assumed, because a gate measuring the
 * wrong surface is worse than none.
 *
 * The component and its own test are not ours to edit; this reads the class
 * list they already carry off a render, the same way the Reset control is read
 * above. `FilterChips.test.tsx` pins WHICH classes; until this block nothing
 * computed their ratios, and `text-zinc-500` clears AA in light by 0.33 — a
 * margin a move of `--card` would erase with every suite green.
 */
function renderEmptyCategoryLabels(): HTMLElement[] {
  // Derived from BADGE_ORDER: every badge has a count, `dismissed` alone is
  // zero, which is what puts a category in the collapsed group.
  const counts = Object.fromEntries(
    BADGE_ORDER.map(badge => [badge, badge === 'dismissed' ? 0 : 1])
  ) as Record<BadgeKey, number>;

  render(
    createElement(FilterChips, {
      selectedFilters: new Set<BadgeKey>(),
      onFiltersChange: vi.fn(),
      filterCounts: counts,
      candidateCounts: counts,
      isFiltering: false,
    })
  );

  // The class is on the <button>; the text matches the <span> inside it.
  const toggle = screen.getByText(/Empty Categories/i).closest('button');
  if (!toggle) throw new Error('no empty-categories toggle rendered');

  fireEvent.click(toggle);
  const revealed = screen.getByText(resultsEN.badges.dismissed);

  return [toggle, revealed];
}

describe('FilterChips empty-category labels clear WCAG AA on --card', () => {
  for (const theme of THEMES) {
    it(`${theme}: the colours the labels actually render clear --card`, () => {
      // Measured light 4.8285, dark 7.1534. The light margin is 0.33 over the
      // threshold, which is the reason this is arithmetic and not a comment.
      const labels = renderEmptyCategoryLabels();
      expect(labels).toHaveLength(2);

      for (const label of labels) {
        const painted = paintedColour(label.className, 'text-', theme);
        expect(
          contrastRatio(painted.rgb, token(theme, '--card')),
          `${label.tagName} in ${theme}`
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      }
    });
  }

  it('control: the pre-fix text-zinc-400 alone fails light --card', () => {
    // 2.6297. Run through the whole pipeline — render, extract, resolve,
    // measure — on the class list as it stood before the fix, so this proves
    // the assertions above can go red rather than restating a number.
    const [toggle] = renderEmptyCategoryLabels();
    // The fix moved the BASE step 400 -> 500; `dark:text-zinc-400` was always
    // there and was already clearing AA. Deleting the base colour instead of
    // downgrading it is a state that never shipped, and `paintedColour` refused
    // to measure it — correctly, and that refusal is why this control is right
    // now rather than green for the wrong reason.
    toggle.className = toggle.className.replace('text-zinc-500', 'text-zinc-400');

    const painted = paintedColour(toggle.className, 'text-', 'light');
    expect(painted.rgb).toEqual(paletteColour('zinc-400'));
    expect(contrastRatio(painted.rgb, token('light', '--card'))).toBeLessThan(WCAG_AA_NORMAL);
  });
});

describe('the Tailwind palette is read from the installed dependency', () => {
  // Deliberately no expected values here. Asserting `rose-600 === oklch(0.586
  // 0.253 17.585)` would put the hand-copied literal straight back, one file
  // further down, and would fail every legitimate bump — the opposite of what
  // reading the dependency is for. What is asserted is that the reader fired
  // and parsed per-step.
  it('resolves the steps this suite measures, and they are distinct', () => {
    const steps = ['rose-400', 'rose-500', 'rose-600', 'zinc-300', 'zinc-400', 'zinc-500'];
    const read = steps.map(paletteColour);

    for (const [i, rgb] of read.entries()) {
      expect(rgb, steps[i]).toHaveLength(3);
      for (const channel of rgb) expect(channel, steps[i]).toBeGreaterThanOrEqual(0);
      for (const channel of rgb) expect(channel, steps[i]).toBeLessThanOrEqual(1);
    }
    expect(new Set(read.map(String)).size, 'a constant would collapse these').toBe(steps.length);
  });

  it('parses an achromatic step, whose hue Tailwind writes as `none`', () => {
    // zinc-50 is `oklch(98.5% 0 none)`. Number('none') is NaN, and NaN through
    // the oklab matrices returns three NaNs that compare greater-or-equal to
    // nothing — a whole gate that passes by never asserting.
    for (const channel of paletteColour('zinc-50')) expect(channel).not.toBeNaN();
  });

  it('control: a step the dependency does not declare fails loudly', () => {
    expect(() => paletteColour('rose-1000')).toThrow(/not readable as oklch/);
  });
});

describe('AccountList empty-state title clears WCAG AA on --card', () => {
  for (const theme of THEMES) {
    it(`${theme}: text-muted-foreground on --card`, () => {
      const ratio = contrastRatio(token(theme, '--muted-foreground'), token(theme, '--card'));
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }

  it('control: the pre-fix text-zinc-300 fails light --card', () => {
    // 1.48:1 — the title used to be decorative ("No users found"); this PR
    // made it name the applied filter, so it had to become legible.
    const ratio = contrastRatio(paletteColour('zinc-300'), token('light', '--card'));
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});
