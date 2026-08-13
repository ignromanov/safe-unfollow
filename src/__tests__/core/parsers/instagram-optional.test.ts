import { describe, it, expect, vi } from 'vitest';
import { parseOptionalFiles } from '@/core/parsers/instagram-optional';
import { FILE_SPECS, PERMANENT_REQUESTS_SPEC } from '@/core/parsers/instagram-file-specs';
import {
  ARRAY_NO_USERNAME_FIELD,
  ARRAY_UNREADABLE_ENTRIES,
  EMPTY_ARRAY,
  NULL_PAYLOAD,
  UNKNOWN_TOP_LEVEL_KEY,
  VALID_ARRAY_OF_ONE,
  makeEntry,
  objectInsteadOfArray,
} from '../../fixtures/instagram-format-drift';

/**
 * GH#21, Path B: the six OPTIONAL relationship files (pending, restricted,
 * close_friends, recently_unfollowed, dismissed_suggestions, permanent
 * requests) went through `readListMapFlexible`, which did
 * `.find(e => Array.isArray(e))` and silently returned `found: true, count: 0`
 * whenever no candidate matched — indistinguishable from a genuinely empty
 * file. That is disproportionate to fail the whole upload over (optional
 * drift zeroes one badge, not the core following/followers math), so these
 * get severity 'warning' instead of 'error' — but 'warning' is rendered
 * nowhere in the UI today, so parseOptionalFiles must at least surface a real
 * warnings array (it was hardcoded to `[]`) for a caller to act on.
 *
 * Tested directly against parseOptionalFiles — the actual function
 * parseInstagramZipFile calls — rather than through a full ZIP mock, since it
 * takes a plain readJsonFromZip callback and is a pure unit under test.
 */

// pending_follow_requests.json — first of the FILE_SPECS optional entries
// (FILE_SPECS[0]/[1] are following/followers, not optional).
const pendingSpec = FILE_SPECS[2]!;

function makeReader(data: unknown, path = pendingSpec.fileNames[0]!) {
  return vi.fn().mockImplementation(async (patterns: string[]) => {
    // Only respond for the pending file's own patterns so the other five
    // specs (and the permanent-requests spec) report "not found" — keeps
    // each test isolated to the one file under test.
    if (patterns.some(p => p.endsWith(path))) {
      return { data, path };
    }
    return null;
  });
}

describe('parseOptionalFiles format drift (GH#21)', () => {
  it('sanity: FILE_SPECS[2] is pending_follow_requests.json', () => {
    expect(pendingSpec.name).toBe('pending_follow_requests.json');
  });

  it.each([
    ['unknown top-level key', UNKNOWN_TOP_LEVEL_KEY],
    ['null payload', NULL_PAYLOAD],
    ['object instead of array', objectInsteadOfArray('relationships_follow_requests_sent')],
  ])('warns INVALID_PENDING_FORMAT (warning) for %s', async (_label, data) => {
    const reader = makeReader(data);
    const result = await parseOptionalFiles([], reader);

    const drift = result.warnings.find(w => w.code === 'INVALID_PENDING_FORMAT');
    expect(drift).toBeDefined();
    expect(drift?.severity).toBe('warning');
    expect(result.pendingResult.found).toBe(true);
    expect(result.pendingResult.count).toBe(0);
  });

  it('does NOT warn for a genuinely empty array (regression)', async () => {
    const reader = makeReader(EMPTY_ARRAY);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings.find(w => w.code === 'INVALID_PENDING_FORMAT')).toBeUndefined();
    expect(result.pendingResult.found).toBe(true);
    expect(result.pendingResult.count).toBe(0);
  });

  it('does NOT warn for an array with no recognizable username field (regression)', async () => {
    const reader = makeReader(ARRAY_NO_USERNAME_FIELD);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings.find(w => w.code === 'INVALID_PENDING_FORMAT')).toBeUndefined();
    expect(result.pendingResult.count).toBe(0);
  });

  it('does NOT warn and extracts data for a valid array (sanity)', async () => {
    const reader = makeReader(VALID_ARRAY_OF_ONE);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings).toHaveLength(0);
    expect(result.pendingResult.count).toBe(1);
    expect(result.pendingResult.map.has('validuser')).toBe(true);
  });

  it('accepts a single bare entry object without a format-drift warning (GH#21 Task 2)', async () => {
    // Real shape observed in restricted_profiles.json / removed_suggestions.json
    // in the 2026-08-11 export — a single record with the array wrapper
    // omitted entirely (see raw/connections-2026-08-11).
    const singleObjectPayload = {
      timestamp: 1_700_000_000,
      media: [],
      label_values: [{ label: 'Username', value: 'sample_test_user' }],
      fbid: '10000000000000001',
    };
    const reader = makeReader(singleObjectPayload);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings.find(w => w.code === 'INVALID_PENDING_FORMAT')).toBeUndefined();
    expect(result.pendingResult.found).toBe(true);
    // Task 2 fixed the wrapper; Task 1 reads the entry. The English label
    // takes the fast path, so one lone record is enough here.
    expect(result.pendingResult.count).toBe(1);
    expect(result.pendingResult.map.get('sample_test_user')).toBe(1_700_000_000);
  });

  it('resolves a localised username label across files, not per file (GH#21 Task 1)', async () => {
    // The username label is localised, so it is inferred from how its values
    // behave across the whole archive. This fixture builds the case pooling
    // exists for: a single-record file whose display name is ITSELF
    // username-shaped, so standalone it scores 1/1 against 1/1 and resolves
    // nothing. (In both real August archives the single-record files do
    // resolve standalone — their display names are not username-shaped. This
    // is the defensive case, constructed, not observed.) Labels and values
    // here are invented.
    const usernameLabel = 'Χρήστης';
    const nameLabel = 'Όνομα';
    const record = (username: string, name: string) => ({
      timestamp: 1_700_000_000,
      media: [],
      label_values: [
        { label: 'URL', value: '' },
        { label: nameLabel, value: name },
        { label: usernameLabel, value: username },
      ],
      fbid: '10000000000000001',
    });

    const closeFriends = [
      record('sample_user_a', 'A Display Name'),
      record('sample_user_b', 'Another Person'),
      record('sample_user_c', 'Third Person Here'),
      record('sample_user_d', 'Fourth Person'),
    ];
    // Single bare object, and its display name is itself username-shaped.
    const restricted = record('sample_user_e', 'ninthperson');

    const reader = vi.fn().mockImplementation(async (patterns: string[]) => {
      if (patterns.some(p => p.endsWith('close_friends.json'))) {
        return { data: closeFriends, path: 'close_friends.json' };
      }
      if (patterns.some(p => p.endsWith('restricted_profiles.json'))) {
        return { data: restricted, path: 'restricted_profiles.json' };
      }
      return null;
    });
    const result = await parseOptionalFiles([], reader);

    expect(result.closeFriendsResult.count).toBe(4);
    expect(result.restrictedResult.count).toBe(1);
    expect(result.restrictedResult.map.has('sample_user_e')).toBe(true);
    expect(result.restrictedResult.map.has('ninthperson')).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('feeds the membership tiebreak from close/restricted/dismissed only', async () => {
    // Both labels are 100% username-shaped, so scoring cannot separate them and
    // the tiebreak decides. close_friends puts TWO of its `wanted` values in
    // following union followers; recently_unfollowed puts FIVE of its `decoy`
    // values there. If recently_unfollowed were pooled into the tiebreak, the
    // decoy would win 5-2 and every account in the archive would come back
    // under the wrong label. It is excluded because an account you unfollowed
    // is by definition gone from following.json — measured 0/2 and 0/22 on the
    // real archives.
    const wanted = 'Χρήστης';
    const decoy = 'Ψευδώνυμο';
    const record = (wantedValue: string, decoyValue: string) => ({
      timestamp: 1_700_000_000,
      label_values: [
        { label: wanted, value: wantedValue },
        { label: decoy, value: decoyValue },
      ],
    });

    const closeFriends = [record('known_one', 'other_one'), record('known_two', 'other_two')];
    const recentlyUnfollowed = Array.from({ length: 5 }, (_unused, index) =>
      record(`fresh_user_${index}`, `known_decoy_${index}`)
    );
    const known = new Set([
      'known_one',
      'known_two',
      ...Array.from({ length: 5 }, (_unused, index) => `known_decoy_${index}`),
    ]);

    const reader = vi.fn().mockImplementation(async (patterns: string[]) => {
      if (patterns.some(p => p.endsWith('close_friends.json'))) {
        return { data: closeFriends, path: 'close_friends.json' };
      }
      if (patterns.some(p => p.endsWith('recently_unfollowed_profiles.json'))) {
        return { data: recentlyUnfollowed, path: 'recently_unfollowed_profiles.json' };
      }
      return null;
    });
    const result = await parseOptionalFiles([], reader, known);

    expect([...result.closeFriendsResult.map.keys()]).toEqual(['known_one', 'known_two']);
    expect([...result.unfollowedResult.map.keys()]).toEqual([
      'fresh_user_0',
      'fresh_user_1',
      'fresh_user_2',
      'fresh_user_3',
      'fresh_user_4',
    ]);
  });

  it('leaves the tiebreak inert when no known usernames are passed', async () => {
    // Same ambiguous archive, no following union followers. Nothing resolves,
    // and every entry is counted rather than guessed at.
    const record = (left: string, right: string) => ({
      timestamp: 1_700_000_000,
      label_values: [
        { label: 'Χρήστης', value: left },
        { label: 'Ψευδώνυμο', value: right },
      ],
    });
    const reader = vi.fn().mockImplementation(async (patterns: string[]) => {
      if (patterns.some(p => p.endsWith('close_friends.json'))) {
        return { data: [record('known_one', 'other_one')], path: 'close_friends.json' };
      }
      return null;
    });
    const result = await parseOptionalFiles([], reader);

    expect(result.closeFriendsResult.count).toBe(0);
    expect(result.closeFriendsResult.unresolvedEntries).toBe(1);
  });

  it('counts entries it could not read (contract with Task 3 diagnostics)', async () => {
    // Two labels whose values both look like usernames every time: the
    // archive gives no signal, so nothing is resolved and every record is
    // unreadable. Reporting count 0 alone is what let a drifted export look
    // like an empty file.
    const pair = (left: string, right: string) => ({
      timestamp: 1_700_000_000,
      label_values: [
        { label: 'Χρήστης', value: left },
        { label: 'Ψευδώνυμο', value: right },
      ],
    });
    const unreadable = [
      pair('sample_user_a', 'sample_user_b'),
      pair('sample_user_c', 'sample_user_d'),
    ];
    const reader = makeReader(unreadable);
    const result = await parseOptionalFiles([], reader);

    expect(result.pendingResult.count).toBe(0);
    expect(result.pendingResult.unresolvedEntries).toBe(2);
  });

  it('returns no warnings and found:false when the file is absent entirely', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings).toHaveLength(0);
    expect(result.pendingResult.found).toBe(false);
  });

  // Every optional file (including permanent-requests, which is not part of
  // FILE_SPECS.slice(2)) must carry its own drift code so a stats event can
  // report which file drifted without ambiguity.
  it.each([
    ['restricted_profiles.json', FILE_SPECS[3]!, 'INVALID_RESTRICTED_FORMAT', 'restrictedResult'],
    ['close_friends.json', FILE_SPECS[4]!, 'INVALID_CLOSE_FRIENDS_FORMAT', 'closeFriendsResult'],
    [
      'recently_unfollowed_profiles.json',
      FILE_SPECS[5]!,
      'INVALID_UNFOLLOWED_FORMAT',
      'unfollowedResult',
    ],
    ['removed_suggestions.json', FILE_SPECS[6]!, 'INVALID_DISMISSED_FORMAT', 'dismissedResult'],
    [
      'recent_follow_requests.json',
      PERMANENT_REQUESTS_SPEC,
      'INVALID_PERMANENT_FORMAT',
      'permanentResult',
    ],
  ] as const)('drifts $0 as $2', async (_fileName, spec, expectedCode, resultKey) => {
    const reader = makeReader(UNKNOWN_TOP_LEVEL_KEY, spec.fileNames[0]!);
    const result = await parseOptionalFiles([], reader);

    const drift = result.warnings.find(w => w.code === expectedCode);
    expect(drift).toBeDefined();
    expect(drift?.severity).toBe('warning');
    expect((result[resultKey as keyof typeof result] as { found: boolean }).found).toBe(true);
  });
});

/**
 * GH#21 Task 3. #32 asks "did the wrapper parse". Four of the six files that
 * broke in the 2026-08-11 export are plain arrays, so `Array.isArray` passes,
 * `formatValid` stays true, and every record still resolves to nothing. These
 * are the tests for the signal that reaches those four.
 */
describe('parseOptionalFiles entry-level drift (GH#21 Task 3)', () => {
  const closeFriendsSpec = FILE_SPECS[4]!;
  const closeFriendsFile = closeFriendsSpec.fileNames[0]!;

  it('sanity: FILE_SPECS[4] is close_friends.json', () => {
    expect(closeFriendsSpec.name).toBe('close_friends.json');
  });

  it('warns at entry level, not file level, when the wrapper is fine and no record reads', async () => {
    const reader = makeReader(ARRAY_UNREADABLE_ENTRIES, closeFriendsFile);
    const result = await parseOptionalFiles([], reader);

    const entryDrift = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS');
    expect(entryDrift).toBeDefined();
    expect(entryDrift?.severity).toBe('warning');
    expect(entryDrift?.message).toContain('3');
    // The fix must not send the reader back to Instagram for a fresh export:
    // the export is fine, we are the ones who cannot read it.
    expect(entryDrift?.fix).toMatch(/re-requesting/i);

    // #32's file-level signal must stay quiet — the wrapper was recognized.
    expect(result.warnings.find(w => w.code === 'INVALID_CLOSE_FRIENDS_FORMAT')).toBeUndefined();
    expect(result.closeFriendsResult.formatValid).toBe(true);
    expect(result.closeFriendsResult.unresolvedEntries).toBe(3);
  });

  it('leaves #32 alone: an unrecognized wrapper stays file-level only', async () => {
    const reader = makeReader({ nonsense: 1 }, closeFriendsFile);
    const result = await parseOptionalFiles([], reader);

    expect(result.warnings.find(w => w.code === 'INVALID_CLOSE_FRIENDS_FORMAT')).toBeDefined();
    expect(
      result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS')
    ).toBeUndefined();
  });

  it.each([
    ['bare empty array', EMPTY_ARRAY],
    ['empty wrapper object', { relationships_close_friends: [] }],
  ])('stays completely silent for a genuinely empty file (%s)', async (_label, data) => {
    const reader = makeReader(data, closeFriendsFile);
    const result = await parseOptionalFiles([], reader);

    // Not "no entry-level warning" — no warning at all. Most people have no
    // close friends list, and a diagnostic that fires for them is noise that
    // buries the one that matters.
    expect(result.warnings).toHaveLength(0);
    expect(result.closeFriendsResult.unresolvedEntries).toBe(0);
  });

  it('reads a total failure differently from a partial one', async () => {
    const total = await parseOptionalFiles(
      [],
      makeReader(ARRAY_UNREADABLE_ENTRIES, closeFriendsFile)
    );
    const partial = await parseOptionalFiles(
      [],
      makeReader([makeEntry('sample_user_a'), { media_list_data: [] }], closeFriendsFile)
    );

    const totalMessage = total.warnings.find(
      w => w.code === 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS'
    )?.message;
    const partialMessage = partial.warnings.find(
      w => w.code === 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS'
    )?.message;

    // Zero of three is the 2026-08-11 signature and a different fact from
    // "one of two records changed": the first means the file is gone, the
    // second means it is degraded.
    expect(totalMessage).toMatch(/none of them/i);
    expect(partialMessage).toBeDefined();
    expect(partialMessage).not.toMatch(/none of them/i);
    expect(partialMessage).toContain('1');
    expect(partial.closeFriendsResult.count).toBe(1);
  });

  it('reports permanent_follow_requests in fileExpectations', async () => {
    // Pre-existing hole: the file is read and warned about, but the loop that
    // builds fileExpectations only walked FILE_SPECS.slice(2), so nothing
    // downstream could say anything about one of the two files feeding
    // notFollowingBack.
    const reader = makeReader(VALID_ARRAY_OF_ONE, PERMANENT_REQUESTS_SPEC.fileNames[0]!);
    const result = await parseOptionalFiles([], reader);

    const expectation = result.fileExpectations.find(f => f.name === PERMANENT_REQUESTS_SPEC.name);
    expect(expectation).toBeDefined();
    expect(expectation?.found).toBe(true);
    expect(expectation?.itemCount).toBe(1);
    expect(result.fileExpectations).toHaveLength(6);
  });

  it('lets a FileExpectation say "present, not understood" three different ways', async () => {
    const readExpectation = async (data: unknown) => {
      const result = await parseOptionalFiles([], makeReader(data, closeFriendsFile));
      return result.fileExpectations.find(f => f.name === closeFriendsSpec.name);
    };

    const empty = await readExpectation(EMPTY_ARRAY);
    const unreadableEntries = await readExpectation(ARRAY_UNREADABLE_ENTRIES);
    const unreadableShape = await readExpectation({ nonsense: 1 });

    // All three report itemCount 0. Without the extra fields a renderer cannot
    // tell them apart, and "found: 0" is the wrong story for two of them.
    expect(empty?.itemCount).toBe(0);
    expect(unreadableEntries?.itemCount).toBe(0);
    expect(unreadableShape?.itemCount).toBe(0);

    expect(empty?.unreadableItemCount).toBe(0);
    expect(empty?.formatUnreadable).toBe(false);

    expect(unreadableEntries?.unreadableItemCount).toBe(3);
    expect(unreadableEntries?.formatUnreadable).toBe(false);

    expect(unreadableShape?.formatUnreadable).toBe(true);
    // Pins what the docblock on FileExpectation.unreadableItemCount claims: a
    // number is always written, and 0 does NOT mean "nothing was wrong" — an
    // unrecognized top level leaves nothing to count. A renderer needs both
    // fields. The doc previously promised `undefined` here, which no producer
    // ever wrote.
    expect(unreadableShape?.unreadableItemCount).toBe(0);

    const absent = await (async () => {
      const result = await parseOptionalFiles([], vi.fn().mockResolvedValue(null));
      return result.fileExpectations.find(f => f.name === closeFriendsSpec.name);
    })();
    expect(absent?.found).toBe(false);
    expect(absent?.unreadableItemCount).toBe(0);
    expect(absent?.formatUnreadable).toBe(false);
  });
});
