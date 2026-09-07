// Single source of truth for badge styles - V3 OKLCH color palette
import type { BadgeKey } from '@/core/types';

const BADGE_STYLE_MAP: Record<string, string> = {
  following:
    'bg-[oklch(0.6_0.15_250_/_0.12)] text-[oklch(0.6_0.15_250)] border-[oklch(0.6_0.15_250_/_0.2)]',
  followers:
    'bg-[oklch(0.7_0.15_150_/_0.12)] text-[oklch(0.6_0.18_150)] border-[oklch(0.7_0.15_150_/_0.2)]',
  mutuals:
    'bg-[oklch(0.6_0.18_264_/_0.12)] text-[oklch(0.6_0.18_264)] border-[oklch(0.6_0.18_264_/_0.2)]',
  notFollowingBack:
    'bg-[oklch(0.6_0.2_25_/_0.12)] text-[oklch(0.6_0.2_25)] border-[oklch(0.6_0.2_25_/_0.2)]',
  notFollowedBack:
    'bg-[oklch(0.75_0.15_80_/_0.12)] text-[oklch(0.7_0.18_80)] border-[oklch(0.75_0.15_80_/_0.2)]',
  unfollowed:
    'bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.55_0.25_25)] border-[oklch(0.6_0.22_25_/_0.3)] font-bold',
  pending:
    'bg-[oklch(0.7_0.15_50_/_0.12)] text-[oklch(0.65_0.18_50)] border-[oklch(0.7_0.15_50_/_0.2)]',
  permanent:
    'bg-[oklch(0.55_0.2_25_/_0.12)] text-[oklch(0.55_0.2_25)] border-[oklch(0.55_0.2_25_/_0.2)]',
  restricted:
    'bg-[oklch(0.5_0_0_/_0.12)] text-[oklch(0.4_0_0)] dark:text-[oklch(0.8_0_0)] border-[oklch(0.5_0_0_/_0.2)]',
  close:
    'bg-[oklch(0.65_0.2_340_/_0.12)] text-[oklch(0.65_0.2_340)] border-[oklch(0.65_0.2_340_/_0.2)]',
  dismissed:
    'bg-[oklch(0.5_0.05_250_/_0.12)] text-[oklch(0.5_0.05_250)] border-[oklch(0.5_0.05_250_/_0.2)]',
};

export const BADGE_STYLES: Record<string, string> = BADGE_STYLE_MAP;

/**
 * The same eleven hues as `BADGE_STYLES`, carried by the tint and the border
 * only — deliberately with no `text-[...]` of its own.
 *
 * Reusing `BADGE_STYLES` on the applied-filter chips was the obvious move and
 * is the wrong one: its `text-[...]` colours are what GH#211 measured failing
 * WCAG AA on `--card` (5 of 6 below 4.5:1, `pending` worst at 3.44:1), so
 * reusing them would import a filed contrast defect into a new surface. The
 * split here is the smaller-visual-change remedy GH#211 itself proposes —
 * hue in the background and border, label on a neutral foreground token —
 * prototyped on one surface before the account rows follow.
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
