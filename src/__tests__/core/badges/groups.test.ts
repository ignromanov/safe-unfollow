import { describe, expect, it } from 'vitest';
import { BADGE_ORDER } from '@/core/badges';
import { BADGE_GROUPS, groupOf } from '@/core/badges/groups';
import type { BadgeKey } from '@/core/types';

describe('BADGE_GROUPS', () => {
  it('should partition every badge in BADGE_ORDER exactly once', () => {
    const grouped = BADGE_GROUPS.flatMap(g => g.members);

    expect([...grouped].sort()).toEqual([...BADGE_ORDER].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('should place the five relationship badges on one axis', () => {
    const relationship = BADGE_GROUPS.find(g => g.id === 'relationship');

    expect(relationship?.members).toEqual(
      expect.arrayContaining<BadgeKey>([
        'followers',
        'following',
        'mutuals',
        'notFollowingBack',
        'notFollowedBack',
      ])
    );
  });

  it('should answer groupOf for every badge', () => {
    for (const badge of BADGE_ORDER) {
      expect(BADGE_GROUPS.some(g => g.id === groupOf(badge))).toBe(true);
    }
  });
});
