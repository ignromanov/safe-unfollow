/**
 * Guards the three contrast fixes on `/results`: the "Reset" control in
 * `AppliedFilters`, and the empty-state title in `AccountList`, which this PR
 * made load-bearing — it now names the applied filter, so it is the only
 * thing telling the reader why the list is empty.
 *
 * Both sit on `--card`: `AppliedFilters` renders inside the sidebar card
 * (`AccountListSection.tsx`, the `bg-card ... rounded-4xl` panel around the
 * filter sheet), and `AccountList`'s empty state is the `bg-card` box it
 * returns directly (`AccountList.tsx`).
 *
 * `--card` and `--muted-foreground` are our own tokens, read live from
 * `src/styles.css` via `token()`/`readThemeTokens()` — never hardcoded, so
 * this stays correct if either token moves. `rose-600`/`rose-400` are not
 * ours: they live in `node_modules/tailwindcss/theme.css` (installed
 * tailwindcss 4.3.3), so they are pinned as oklch literals with that file
 * named as their source rather than read from the dependency at test time.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, oklchToRgb, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

// node_modules/tailwindcss/theme.css (tailwindcss 4.3.3)
const ROSE_400 = oklchToRgb(0.712, 0.194, 13.428);
const ROSE_500 = oklchToRgb(0.645, 0.246, 16.439);
const ROSE_600 = oklchToRgb(0.586, 0.253, 17.585);
const ZINC_300 = oklchToRgb(0.871, 0.006, 286.286);

describe('AppliedFilters "Reset" control clears WCAG AA on --card', () => {
  it('light: text-rose-600 on --card', () => {
    // Measured ~4.5104 — 0.01 above the 4.5 threshold. It is the only rose
    // value that clears both themes on --card (rose-500 fails light at
    // 3.76:1; a higher step than rose-600 loses the dark-mode pairing), so
    // the margin is accepted rather than swapped for a safer colour.
    const ratio = contrastRatio(ROSE_600, token('light', '--card'));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('dark: text-rose-400 on --card', () => {
    const ratio = contrastRatio(ROSE_400, token('dark', '--card'));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('control: the pre-fix text-rose-500 fails light --card', () => {
    const ratio = contrastRatio(ROSE_500, token('light', '--card'));
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});

describe('AccountList empty-state title clears WCAG AA on --card', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: text-muted-foreground on --card`, () => {
      const ratio = contrastRatio(token(theme, '--muted-foreground'), token(theme, '--card'));
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }

  it('control: the pre-fix text-zinc-300 fails light --card', () => {
    // 1.48:1 — the title used to be decorative ("No users found"); this PR
    // made it name the applied filter, so it had to become legible.
    const ratio = contrastRatio(ZINC_300, token('light', '--card'));
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});
