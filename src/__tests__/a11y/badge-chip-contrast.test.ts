/**
 * Guards the badge chips on the account rows — the surface `BADGE_STYLES`
 * actually paints, and the one nothing measured.
 *
 * `results-surface-contrast.test.ts` measures `AppliedFilters`, which carries
 * `BADGE_CHIP_STYLES`: hue in the tint and the border, label on a neutral token.
 * That map's own docstring calls itself a prototype "before the account rows
 * follow". This file is the arithmetic that makes them follow — and, until they
 * do, the arithmetic that says they have not.
 *
 * ⛔ What is measured is read off the rendered component, never declared here.
 * The sibling file records why: an auditor reverted `AppliedFilters` to a broken
 * colour and its suite stayed green, because nothing connected the literal to
 * the component. Every ratio below comes from `render()`.
 *
 * The surface is `--card`: `AccountList` returns the rows inside its
 * `bg-card rounded-4xl` panel (`AccountList.tsx:83,126`), and each chip tints
 * that card with 12% of its own hue. Measuring against bare `--card` — as GH#211
 * did — is a ceiling, not a worst case.
 *
 * Conditioned on the published claim, the shape #184 established: `docs/
 * accessibility.md` says "WCAG 2.1 AA", and if that sentence is ever withdrawn
 * these assertions withdraw with it rather than enforcing a standard nobody
 * promised. The guard at the bottom is what stops that conditional from turning
 * a broken promise into a silent skip.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, over, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';
import { paintedColour, paletteColour, THEMES } from '@tests/utils/tailwind-colour';
import { AccountItem } from '@/components/AccountItem';
import { BADGE_ORDER } from '@/core/badges';
import type { BadgeMap } from '@/core/types';
import resultsEN from '@/locales/en/results.json';

const ACCESSIBILITY_MD = resolve(process.cwd(), 'docs/accessibility.md');
const CLAIMS_AA = /WCAG\s*2\.1\s*AA/i.test(readFileSync(ACCESSIBILITY_MD, 'utf8'));

/**
 * One row with every badge lit, so the chips come back in `BADGE_ORDER` and no
 * badge can be missed by a fixture that happens not to carry it.
 */
function renderAllBadgeChips(): HTMLElement[] {
  const badges = Object.fromEntries(BADGE_ORDER.map(b => [b, true])) as BadgeMap;
  render(
    createElement(AccountItem, {
      account: { username: 'testuser', badges },
      index: 0,
      totalCount: 1,
    })
  );

  return BADGE_ORDER.map(badge =>
    screen.getByText(resultsEN.badges[badge as keyof typeof resultsEN.badges])
  );
}

describe('account-row badge chips clear WCAG AA on the card they sit on', () => {
  it('renders one chip per badge — the instrument fired', () => {
    // Without this, a selector that silently matched nothing would make every
    // assertion below pass over an empty list.
    expect(renderAllBadgeChips()).toHaveLength(BADGE_ORDER.length);
  });

  for (const theme of THEMES) {
    it.runIf(CLAIMS_AA)(`${theme}: every chip label clears 4.5:1 over its own tint`, () => {
      const chips = renderAllBadgeChips();
      expect(chips).toHaveLength(BADGE_ORDER.length);

      const card = token(theme, '--card');
      const failures: string[] = [];

      BADGE_ORDER.forEach((badge, i) => {
        const tint = paintedColour(chips[i].className, 'bg-', theme);
        const label = paintedColour(chips[i].className, 'text-', theme);
        const ratio = contrastRatio(label.rgb, over(tint.rgb, tint.alpha, card));
        if (ratio < WCAG_AA_NORMAL) failures.push(`${badge} ${ratio.toFixed(2)}:1`);
      });

      expect(failures, `below 4.5:1 in ${theme}`).toEqual([]);
    });

    it.runIf(CLAIMS_AA)(`${theme}: every chip label also clears 4.5:1 on bare --card`, () => {
      // The tint is not the only surface: the row carries a hover fill, and the
      // chip scroller can overhang it. Bare --card is the pairing GH#211 quoted
      // and the one a reader sees at rest between chips.
      const chips = renderAllBadgeChips();
      const card = token(theme, '--card');
      const failures: string[] = [];

      BADGE_ORDER.forEach((badge, i) => {
        const label = paintedColour(chips[i].className, 'text-', theme);
        const ratio = contrastRatio(label.rgb, card);
        if (ratio < WCAG_AA_NORMAL) failures.push(`${badge} ${ratio.toFixed(2)}:1`);
      });

      expect(failures, `below 4.5:1 on bare --card in ${theme}`).toEqual([]);
    });
  }

  it('keeps every chip on its own hue rather than one shared fill', () => {
    // The colour coding is the chip's job. A fix that made every label legible
    // by flattening the tints would pass the arithmetic and break the product.
    const chips = renderAllBadgeChips();
    const tints = chips.map(chip => String(paintedColour(chip.className, 'bg-', 'light').lch));
    expect(new Set(tints).size).toBe(BADGE_ORDER.length);
  });

  it('control: a zinc-300 label would fail over the first chip tint', () => {
    // Run through the same pipeline the assertions use, so this proves they can
    // go red rather than restating a number.
    const chips = renderAllBadgeChips();
    const tint = paintedColour(chips[0].className, 'bg-', 'light');
    const ratio = contrastRatio(
      paletteColour('zinc-300'),
      over(tint.rgb, tint.alpha, token('light', '--card'))
    );
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });

  it('the published AA claim is still there, so the conditionals above ran', () => {
    // Guards every `runIf` in this file. Without it, a reword of
    // accessibility.md would skip the whole gate and report green — a skip and a
    // broken promise are different outcomes, and only this line tells them apart.
    expect(CLAIMS_AA, `no "WCAG 2.1 AA" found in ${ACCESSIBILITY_MD}`).toBe(true);
  });
});
