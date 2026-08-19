// Global functions from vitest
import {
  buildAccountBadgeIndex,
  badgesAffectedByTruncation,
  filterAccountsByBadges,
  BADGE_ORDER,
  BADGE_LABELS,
  BADGE_COLORS,
} from '@/core/badges';
import { createTestParsedData, TEST_ACCOUNTS } from '@tests/fixtures/testData';
import type { BadgeKey, ParsedAll } from '@/core/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Badge Logic', () => {
  const testData = createTestParsedData();

  // Helper function to test special badge types
  const testSpecialBadge = (badgeType: BadgeKey, testAccounts: string[], result: any[]) => {
    testAccounts.forEach(username => {
      const account = result.find(acc => acc.username === username);
      expect(account).toBeDefined();
      expect(account!.badges[badgeType]).toBeTruthy();
    });
  };

  describe('buildAccountBadgeIndex', () => {
    it('should build correct badge index for all account types', () => {
      const result = buildAccountBadgeIndex(testData);

      // Should include all unique usernames
      const allUsernames = new Set([
        ...TEST_ACCOUNTS.following,
        ...TEST_ACCOUNTS.followers,
        ...TEST_ACCOUNTS.pending,
        ...TEST_ACCOUNTS.permanent,
        ...TEST_ACCOUNTS.restricted,
        ...TEST_ACCOUNTS.close,
        ...TEST_ACCOUNTS.unfollowed,
        ...TEST_ACCOUNTS.dismissed,
      ]);

      expect(result).toHaveLength(allUsernames.size);

      // Check that all usernames are present
      const resultUsernames = new Set(result.map(acc => acc.username));
      expect(resultUsernames).toEqual(allUsernames);
    });

    it('should correctly identify mutual accounts', () => {
      const result = buildAccountBadgeIndex(testData);

      // Mutual accounts are those in both following and followers
      TEST_ACCOUNTS.mutuals.forEach(username => {
        const account = result.find(acc => acc.username === username);
        expect(account).toBeDefined();

        // Mutual accounts should have these badges
        const expectedBadges: BadgeKey[] = ['following', 'followers', 'mutuals'];
        expectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeTruthy();
        });

        // Mutual accounts should NOT have these badges
        const unexpectedBadges: BadgeKey[] = ['notFollowingBack', 'notFollowedBack'];
        unexpectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeUndefined();
        });
      });
    });

    it('should correctly identify not following back accounts', () => {
      const result = buildAccountBadgeIndex(testData);

      // Not following back accounts are in following but not in followers (and not pending/permanent)
      TEST_ACCOUNTS.notFollowingBack.forEach(username => {
        const account = result.find(acc => acc.username === username);
        expect(account).toBeDefined();

        // Not following back accounts should have these badges
        const expectedBadges: BadgeKey[] = ['following', 'notFollowingBack'];
        expectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeTruthy();
        });

        // Not following back accounts should NOT have these badges
        const unexpectedBadges: BadgeKey[] = ['followers', 'mutuals'];
        unexpectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeFalsy();
        });
      });
    });

    it('should correctly identify not followed back accounts', () => {
      const result = buildAccountBadgeIndex(testData);

      // Not followed back accounts are in followers but not in following
      TEST_ACCOUNTS.notFollowedBack.forEach(username => {
        const account = result.find(acc => acc.username === username);
        expect(account).toBeDefined();

        // Not followed back accounts should have these badges
        const expectedBadges: BadgeKey[] = ['followers', 'notFollowedBack'];
        expectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeTruthy();
        });

        // Not followed back accounts should NOT have these badges
        const unexpectedBadges: BadgeKey[] = ['following', 'mutuals'];
        unexpectedBadges.forEach(badge => {
          expect(account!.badges[badge]).toBeFalsy();
        });
      });
    });

    it('should correctly identify special badge types', () => {
      const result = buildAccountBadgeIndex(testData);

      // Test all special badge types using helper function
      const specialBadgeTests = [
        { badgeType: 'pending' as BadgeKey, accounts: TEST_ACCOUNTS.pending },
        { badgeType: 'permanent' as BadgeKey, accounts: TEST_ACCOUNTS.permanent },
        { badgeType: 'restricted' as BadgeKey, accounts: TEST_ACCOUNTS.restricted },
        { badgeType: 'close' as BadgeKey, accounts: TEST_ACCOUNTS.close },
        { badgeType: 'unfollowed' as BadgeKey, accounts: TEST_ACCOUNTS.unfollowed },
        { badgeType: 'dismissed' as BadgeKey, accounts: TEST_ACCOUNTS.dismissed },
      ];

      specialBadgeTests.forEach(({ badgeType, accounts }) => {
        testSpecialBadge(badgeType, accounts as unknown as string[], result);
      });
    });

    it('should sort accounts alphabetically', () => {
      const result = buildAccountBadgeIndex(testData);

      // Extract usernames and check if they are sorted
      const usernames = result.map(acc => acc.username);
      const sortedUsernames = [...usernames].sort((a, b) => a.localeCompare(b));

      expect(usernames).toEqual(sortedUsernames);
    });
  });

  describe('filterAccountsByBadges', () => {
    const accounts = buildAccountBadgeIndex(testData);

    it('should filter by single badge type', () => {
      const mutuals = filterAccountsByBadges(accounts, new Set(['mutuals']));

      // Check that all filtered accounts have the mutual badge
      mutuals.forEach(account => {
        expect(account.badges.mutuals).toBeTruthy();
      });

      // Check that we get exactly the mutual accounts
      const mutualUsernames = new Set(TEST_ACCOUNTS.mutuals);
      const filteredUsernames = new Set(mutuals.map(acc => acc.username));
      expect(filteredUsernames).toEqual(mutualUsernames);
    });

    it('should filter by multiple badge types (OR logic)', () => {
      const selected: Set<BadgeKey> = new Set(['mutuals', 'notFollowingBack']);
      const filtered = filterAccountsByBadges(accounts, selected);

      // Check that each filtered account has at least one of the selected badges
      filtered.forEach(account => {
        const hasSelectedBadge = Array.from(selected).some(badge => account.badges[badge]);
        expect(hasSelectedBadge).toBeTruthy();
      });

      // Verify we get the expected accounts (mutuals + notFollowingBack)
      const expectedUsernames = new Set([
        ...TEST_ACCOUNTS.mutuals,
        ...TEST_ACCOUNTS.notFollowingBack,
      ]);
      const filteredUsernames = new Set(filtered.map(acc => acc.username));

      // Check that all expected accounts are present
      expectedUsernames.forEach(username => {
        expect(filteredUsernames).toContain(username);
      });

      // Check that filtered accounts are only from expected sets
      filteredUsernames.forEach(username => {
        expect(expectedUsernames).toContain(username);
      });
    });

    it('should return empty array when no filters selected', () => {
      const result = filterAccountsByBadges(accounts, new Set());
      expect(result).toHaveLength(0);
    });

    it('should filter by username query', () => {
      const query = 'alice';
      const result = filterAccountsByBadges(accounts, new Set(['following']), query);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(account => {
        expect(account.username.toLowerCase()).toContain(query.toLowerCase());
      });
    });

    it('should combine badge and username filtering', () => {
      const query = 'mutual';
      const result = filterAccountsByBadges(accounts, new Set(['mutuals']), query);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(account => {
        expect(account.badges.mutuals).toBeTruthy();
        expect(account.username.toLowerCase()).toContain(query.toLowerCase());
      });
    });

    it('should return empty array for non-matching query', () => {
      const query = 'nonexistent_user_12345';
      const result = filterAccountsByBadges(accounts, new Set(['following']), query);
      expect(result).toHaveLength(0);
    });
  });

  describe('Badge constants', () => {
    it('should have consistent badge order', () => {
      expect(BADGE_ORDER).toHaveLength(11);

      // Check that all expected badge types are present
      const expectedBadges: BadgeKey[] = [
        'following',
        'followers',
        'mutuals',
        'notFollowingBack',
        'notFollowedBack',
        'pending',
        'permanent',
        'restricted',
        'close',
        'unfollowed',
        'dismissed',
      ];
      expectedBadges.forEach(badge => {
        expect(BADGE_ORDER).toContain(badge);
      });
    });

    it('should have labels for all badge types', () => {
      BADGE_ORDER.forEach(badge => {
        expect(BADGE_LABELS[badge]).toBeDefined();
        expect(typeof BADGE_LABELS[badge]).toBe('string');
        expect(BADGE_LABELS[badge].length).toBeGreaterThan(0);
      });
    });

    it('should have colors for all badge types', () => {
      BADGE_ORDER.forEach(badge => {
        expect(BADGE_COLORS[badge]).toBeDefined();
        expect(typeof BADGE_COLORS[badge]).toBe('string');
        expect(BADGE_COLORS[badge].length).toBeGreaterThan(0);
      });
    });

    it('should have consistent structure across all badge constants', () => {
      // All constants should have the same keys
      const badgeKeys = new Set(BADGE_ORDER);
      const labelKeys = new Set(Object.keys(BADGE_LABELS));
      const colorKeys = new Set(Object.keys(BADGE_COLORS));

      expect(badgeKeys).toEqual(labelKeys);
      expect(badgeKeys).toEqual(colorKeys);
    });
  });

  /**
   * GH#41. `followRequestsUnreadable` is derived from exactly two files —
   * `pending_follow_requests.json` and the permanent-requests file — because
   * `notFollowingBack` is defined by subtracting exactly those two sets. The
   * flag and the badge are two halves of one fact held in two files, and
   * nothing but this test connects them.
   *
   * If this fails you have changed which sets `notFollowingBack` excludes.
   * Decide whether the caveat still covers the badge:
   *  - a new exclusion from an OPTIONAL file that can be present-but-unreadable
   *    must carry `feedsNotFollowingBackExclusion` on its spec
   *    (`instagram-file-specs.ts`) — that flag is what `parseOptionalFiles`
   *    folds `followRequestsUnreadable` over — or the badge overstates itself
   *    again with nothing on screen saying so;
   *  - `followers` needs nothing: it is required, and an unreadable required
   *    file already fails the upload loudly (`hasMinimalData`).
   * Then update the list below.
   */
  describe('notFollowingBack exclusions stay in sync with the GH#41 caveat flag', () => {
    it('excludes exactly followers, pendingSent and permanentRequests', () => {
      const source = readFileSync(join(process.cwd(), 'src/core/badges/index.ts'), 'utf-8');

      const filterBody = source.match(/const notFollowingBack = new Set\(([\s\S]*?)\n {2}\);/)?.[1];
      expect(filterBody, 'could not locate the notFollowingBack filter').toBeDefined();

      const excluded = [...filterBody!.matchAll(/!parsed\.(\w+)\.has\(u\)/g)].map(m => m[1]);

      expect(excluded).toEqual(['followers', 'pendingSent', 'permanentRequests']);
    });
  });

  describe('badgesAffectedByTruncation', () => {
    it('names nothing when neither file looks short', () => {
      expect(badgesAffectedByTruncation(null).size).toBe(0);
    });

    it('names the badges a short followers file corrupts', () => {
      expect([...badgesAffectedByTruncation('followers')].sort()).toEqual([
        'followers',
        'mutuals',
        'notFollowedBack',
        'notFollowingBack',
      ]);
    });

    it('names the badges a short following file corrupts', () => {
      expect([...badgesAffectedByTruncation('following')].sort()).toEqual([
        'following',
        'mutuals',
        'notFollowedBack',
        'notFollowingBack',
      ]);
    });

    /**
     * The sets above are a claim about arithmetic, and a hand-written constant
     * drifts away from the arithmetic it describes the first time someone
     * changes `computeDerivedRelationships`. So the claim is exercised rather
     * than restated: take a whole export, keep a single follower — the crudest
     * truncation there is — then check that the badges which move are exactly
     * the ones named, and that they move in the direction the caveat claims.
     *
     * It has already earned its place: the first version of
     * `badgesAffectedByTruncation` listed three badges and this found the
     * fourth.
     */
    it('names every badge that actually moves when followers are truncated', () => {
      const whole = createTestParsedData();
      const truncated: ParsedAll = {
        ...whole,
        followers: new Set([...whole.followers].slice(-1)),
      };

      const countsOf = (parsed: ParsedAll) => {
        const index = buildAccountBadgeIndex(parsed);
        const counts = new Map<BadgeKey, number>();
        for (const account of index) {
          for (const key of Object.keys(account.badges) as BadgeKey[]) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        return counts;
      };

      const before = countsOf(whole);
      const after = countsOf(truncated);
      const moved = new Set<BadgeKey>();
      for (const key of new Set([...before.keys(), ...after.keys()])) {
        if ((before.get(key) ?? 0) !== (after.get(key) ?? 0)) moved.add(key);
      }

      expect([...moved].sort()).toEqual([...badgesAffectedByTruncation('followers')].sort());

      // Direction matters as much as membership: the caveat tells the reader
      // that "not following back" is too high and mutuals too low, and saying
      // it backwards would be its own wrong answer.
      expect(after.get('notFollowingBack') ?? 0).toBeGreaterThan(
        before.get('notFollowingBack') ?? 0
      );
      expect(after.get('mutuals') ?? 0).toBeLessThan(before.get('mutuals') ?? 0);
      expect(after.get('notFollowedBack') ?? 0).toBeLessThan(before.get('notFollowedBack') ?? 0);
    });
  });
});
