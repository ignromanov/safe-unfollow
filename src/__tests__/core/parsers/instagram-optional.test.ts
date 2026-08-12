import { describe, it, expect, vi } from 'vitest';
import { parseOptionalFiles } from '@/core/parsers/instagram-optional';
import { FILE_SPECS, PERMANENT_REQUESTS_SPEC } from '@/core/parsers/instagram-file-specs';
import {
  ARRAY_NO_USERNAME_FIELD,
  EMPTY_ARRAY,
  NULL_PAYLOAD,
  UNKNOWN_TOP_LEVEL_KEY,
  VALID_ARRAY_OF_ONE,
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
    // behave across the whole archive. restricted_profiles.json holds ONE
    // record in the real export, where a display name and a username can both
    // look like usernames — that file is only readable because the other five
    // are pooled with it. Labels here are invented, values are invented.
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
