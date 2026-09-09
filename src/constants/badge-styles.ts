// Single source of truth for badge styles - V3 OKLCH color palette
//
// Every `text-` here carries a `dark:text-` beside it, and the two differ: a
// single lightness cannot clear 4.5:1 in both themes for any badge in this set,
// including the achromatic `restricted`, because the label is measured against
// `--card` at one end and against the same hue at 12% over it at the other.
// Solved per theme by nearest-lightness search (GH#211), against BOTH surfaces
// the label can sit on -- the chip's own tint and bare `--card`. Chroma and hue
// are untouched; only L moved.
//
// Margins are thin by construction, 4.51 to 4.58 -- the search takes the value
// closest to the old one that clears the bar, so any move of `--card` erases
// them. That is safe only because `a11y/badge-chip-contrast.test.ts` recomputes
// every ratio from `styles.css` and this file rather than from a recorded
// number, so the palette and the token fail together.
import type { BadgeKey } from '@/core/types';

const BADGE_STYLE_MAP: Record<string, string> = {
  following:
    'bg-[oklch(0.6_0.15_250_/_0.12)] text-[oklch(0.53_0.15_250)] dark:text-[oklch(0.62_0.15_250)] border-[oklch(0.6_0.15_250_/_0.2)]',
  followers:
    'bg-[oklch(0.7_0.15_150_/_0.12)] text-[oklch(0.515_0.18_150)] dark:text-[oklch(0.61_0.18_150)] border-[oklch(0.7_0.15_150_/_0.2)]',
  mutuals:
    'bg-[oklch(0.6_0.18_264_/_0.12)] text-[oklch(0.54_0.18_264)] dark:text-[oklch(0.625_0.18_264)] border-[oklch(0.6_0.18_264_/_0.2)]',
  notFollowingBack:
    'bg-[oklch(0.6_0.2_25_/_0.12)] text-[oklch(0.55_0.2_25)] dark:text-[oklch(0.635_0.2_25)] border-[oklch(0.6_0.2_25_/_0.2)]',
  notFollowedBack:
    'bg-[oklch(0.75_0.15_80_/_0.12)] text-[oklch(0.545_0.18_80)] dark:text-[oklch(0.7_0.18_80)] border-[oklch(0.75_0.15_80_/_0.2)]',
  unfollowed:
    'bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.51_0.25_25)] dark:text-[oklch(0.66_0.25_25)] border-[oklch(0.6_0.22_25_/_0.3)] font-bold',
  pending:
    'bg-[oklch(0.7_0.15_50_/_0.12)] text-[oklch(0.555_0.18_50)] dark:text-[oklch(0.65_0.18_50)] border-[oklch(0.7_0.15_50_/_0.2)]',
  permanent:
    'bg-[oklch(0.55_0.2_25_/_0.12)] text-[oklch(0.545_0.2_25)] dark:text-[oklch(0.63_0.2_25)] border-[oklch(0.55_0.2_25_/_0.2)]',
  restricted:
    'bg-[oklch(0.5_0_0_/_0.12)] text-[oklch(0.4_0_0)] dark:text-[oklch(0.8_0_0)] border-[oklch(0.5_0_0_/_0.2)]',
  close:
    'bg-[oklch(0.65_0.2_340_/_0.12)] text-[oklch(0.56_0.2_340)] dark:text-[oklch(0.65_0.2_340)] border-[oklch(0.65_0.2_340_/_0.2)]',
  dismissed:
    'bg-[oklch(0.5_0.05_250_/_0.12)] text-[oklch(0.5_0.05_250)] dark:text-[oklch(0.61_0.05_250)] border-[oklch(0.5_0.05_250_/_0.2)]',
};

export const BADGE_STYLES: Record<string, string> = BADGE_STYLE_MAP;

/**
 * The same eleven hues as `BADGE_STYLES`, carried by the tint and the border
 * only — deliberately with no `text-[...]` of its own.
 *
 * Reusing `BADGE_STYLES` on the applied-filter chips was the obvious move and
 * was the wrong one at the time: its `text-[...]` colours were what GH#211
 * measured failing WCAG AA, so reusing them would have imported a filed
 * contrast defect into a new surface. That defect is now fixed at the source —
 * `BADGE_STYLES` clears 4.5:1 on both surfaces in both themes — so this map no
 * longer exists to avoid a broken palette.
 *
 * ⛔ It is NOT a prototype the account rows are waiting to follow, which is what
 * this docstring said until the choice was made. The two surfaces diverge on
 * purpose: a row's chip is the only thing naming the badge, so it keeps the hue
 * in its label; an applied-filter chip sits in a row of chips whose job is
 * "these filters are on", and a neutral label reads faster there. GH#211's own
 * magnitude was also wrong — it said 5 of 6 with `pending` worst at 3.44:1; the
 * measurement across all 11 badges × 2 themes × 2 surfaces was 10 of 11, worst
 * `notFollowedBack` at 2.47:1.
 *
 * The tint is 0.18 rather than the rows' 0.12, and the border 0.35 rather than
 * 0.2: at 0.12 with a neutral label the hue is the only thing distinguishing
 * one chip from the next, and 12% of it over white does not survive as a
 * distinction. The rows can stay at 0.12 because their *text* carries the hue
 * too.
 *
 * Typed `Record<BadgeKey, string>` on purpose. `BADGE_STYLES` is
 * `Record<string, string>` and therefore silently tolerates a missing badge;
 * this map is in `src/**`, which `npm run type-check` does read, so a badge
 * added to `BadgeKey` fails the build here rather than rendering an unstyled
 * chip. `results-surface-contrast.test.ts` asserts the key set matches
 * `BADGE_STYLES` at runtime as well, reading both from source.
 */
export const BADGE_CHIP_STYLES: Record<BadgeKey, string> = {
  following: 'bg-[oklch(0.6_0.15_250_/_0.18)] border-[oklch(0.6_0.15_250_/_0.35)]',
  followers: 'bg-[oklch(0.7_0.15_150_/_0.18)] border-[oklch(0.7_0.15_150_/_0.35)]',
  mutuals: 'bg-[oklch(0.6_0.18_264_/_0.18)] border-[oklch(0.6_0.18_264_/_0.35)]',
  notFollowingBack: 'bg-[oklch(0.6_0.2_25_/_0.18)] border-[oklch(0.6_0.2_25_/_0.35)]',
  notFollowedBack: 'bg-[oklch(0.75_0.15_80_/_0.18)] border-[oklch(0.75_0.15_80_/_0.35)]',
  unfollowed: 'bg-[oklch(0.6_0.22_25_/_0.18)] border-[oklch(0.6_0.22_25_/_0.35)]',
  pending: 'bg-[oklch(0.7_0.15_50_/_0.18)] border-[oklch(0.7_0.15_50_/_0.35)]',
  permanent: 'bg-[oklch(0.55_0.2_25_/_0.18)] border-[oklch(0.55_0.2_25_/_0.35)]',
  restricted: 'bg-[oklch(0.5_0_0_/_0.18)] border-[oklch(0.5_0_0_/_0.35)]',
  close: 'bg-[oklch(0.65_0.2_340_/_0.18)] border-[oklch(0.65_0.2_340_/_0.35)]',
  dismissed: 'bg-[oklch(0.5_0.05_250_/_0.18)] border-[oklch(0.5_0.05_250_/_0.35)]',
};

/**
 * The neutral the chip labels take instead of the badge hue.
 *
 * `--card-foreground` rather than `--foreground` because the chips render
 * inside the `bg-card` panel in `AccountListSection`; the two tokens happen to
 * hold the same value in both themes today, and naming the surface's own one
 * keeps that a coincidence rather than a dependency. Measured against every
 * chip tint over `--card` in `results-surface-contrast.test.ts`.
 */
export const BADGE_CHIP_LABEL_CLASS = 'text-card-foreground';
