import type { AccountBadges } from '@/core/types';

const DAY = 86_400;
const START = 1_609_459_200; // 2021-01-01T00:00:00Z

/** A mix close to a real account: 30% not following back, 20% not followed back, 40% mutual, 10% other. */
export function fixtureRow(i: number): AccountBadges {
  const username = `user_${String(i + 1).padStart(5, '0')}`;
  const since = START + (i % 1500) * DAY;
  const kind = i % 10;
  if (kind < 3) return { username, badges: { following: since, notFollowingBack: true } };
  if (kind < 5) return { username, badges: { followers: since, notFollowedBack: true } };
  if (kind < 9) {
    return {
      username,
      badges: {
        following: since,
        followers: since + DAY,
        mutuals: true,
        ...(kind === 8 ? { close: true } : {}),
      },
    };
  }
  return { username, badges: { following: since, pending: true } };
}
