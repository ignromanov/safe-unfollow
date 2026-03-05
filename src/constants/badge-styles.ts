// Single source of truth for badge styles - V3 OKLCH color palette
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
