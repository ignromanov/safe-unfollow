import { describe, it, expect } from 'vitest';
import { resolveEntries, resolveEntry, resolveEntryList } from '@/core/parsers/instagram-utils';

/**
 * GH#21, Task 2: `restricted_profiles.json` / `removed_suggestions.json` in the
 * 2026-08-11 export hold a single bare JSON object instead of an array of one
 * (confirmed against the real export — see raw/connections-2026-08-11). This
 * resolver replaces the `Array.isArray` ladder duplicated across
 * `instagram-optional.ts`, `instagram.ts` (following.json) and
 * `instagram-followers.ts` (followers_*.json), and is what makes
 * `formatValid`/`formatInvalid` false: `null` means "shape not recognized",
 * an empty array means "recognized and genuinely empty" — those two must not
 * collapse into one value.
 */
describe('resolveEntryList', () => {
  it('resolves a bare array as-is', () => {
    const data = [{ title: 'alice' }];
    expect(resolveEntryList(data)).toBe(data);
  });

  it('resolves a propCandidates key whose value is an array', () => {
    const data = { relationships_close_friends: [{ title: 'bob' }] };
    expect(resolveEntryList(data, ['relationships_close_friends'])).toBe(
      data.relationships_close_friends
    );
  });

  it('tries propCandidates in order and returns the first array match', () => {
    const data = { first_key: 'not an array', second_key: [{ title: 'carol' }] };
    expect(resolveEntryList(data, ['first_key', 'second_key'])).toBe(data.second_key);
  });

  it('wraps a single bare entry object carrying label_values (2026-08-11 export shape)', () => {
    const entry = {
      timestamp: 1_700_000_000,
      media: [],
      label_values: [{ label: 'Username', value: 'dana' }],
      fbid: '10000000000000002',
    };
    expect(resolveEntryList(entry)).toEqual([entry]);
  });

  it('wraps a single bare entry object carrying string_list_data', () => {
    const entry = {
      title: 'erin',
      string_list_data: [{ href: 'https://instagram.com/erin/', value: 'erin' }],
    };
    expect(resolveEntryList(entry)).toEqual([entry]);
  });

  it('wraps a single bare entry object carrying only title', () => {
    const entry = { title: 'frank' };
    expect(resolveEntryList(entry)).toEqual([entry]);
  });

  it('does NOT wrap a relationships_* wrapper whose value is not an array', () => {
    const data = { relationships_following: { not: 'an array' } };
    expect(resolveEntryList(data, ['relationships_following'])).toBeNull();
  });

  it('returns null for null', () => {
    expect(resolveEntryList(null)).toBeNull();
  });

  it('returns null for a number', () => {
    expect(resolveEntryList(42)).toBeNull();
  });

  it('returns null for a string', () => {
    expect(resolveEntryList('str')).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(resolveEntryList({})).toBeNull();
  });

  it('returns null when no propCandidates are given and data is not an entry', () => {
    expect(resolveEntryList({ some_other_key: [{ title: 'ghost' }] })).toBeNull();
  });
});

/**
 * GH#21, Task 1: `resolveEntryList` hands back entries; this is the other half
 * — reading a username out of one entry. Three shapes are known, and the
 * resolution order below is load-bearing: the first two are the established
 * formats and must not regress when the third is added.
 *
 * All values in these fixtures are invented. `raw/` holds real exports with
 * real usernames and real fbids of real people, and this repository is public.
 */
describe('resolveEntry', () => {
  it('reads the classic string_list_data[0].value shape with href and timestamp', () => {
    const entry = {
      title: '',
      string_list_data: [
        {
          href: 'https://www.instagram.com/sample_user_a',
          value: 'sample_user_a',
          timestamp: 1_700_000_000,
        },
      ],
    };
    expect(resolveEntry(entry, null)).toEqual({
      username: 'sample_user_a',
      href: 'https://www.instagram.com/sample_user_a',
      timestamp: 1_700_000_000,
    });
  });

  it('falls back to entry.title when string_list_data carries no value', () => {
    const entry = {
      title: 'sample_user_b',
      string_list_data: [{ href: 'https://www.instagram.com/sample_user_b' }],
    };
    expect(resolveEntry(entry, null)).toEqual({
      username: 'sample_user_b',
      href: 'https://www.instagram.com/sample_user_b',
      timestamp: undefined,
    });
  });

  it('lowercases and trims the resolved username', () => {
    expect(resolveEntry({ title: '  Sample_User_C  ' }, null)?.username).toBe('sample_user_c');
  });

  it('reads a label_values entry under the resolved username label', () => {
    const entry = {
      timestamp: 1_700_000_000,
      media: [],
      label_values: [
        { label: 'URL', value: '' },
        { label: 'Name', value: 'A Display Name' },
        { label: 'Username', value: 'sample_user_d' },
      ],
      fbid: '10000000000000001',
    };
    expect(resolveEntry(entry, 'Username')).toEqual({
      username: 'sample_user_d',
      timestamp: 1_700_000_000,
    });
  });

  it('matches the resolved label exactly, padding and casing included', () => {
    const entry = {
      timestamp: 1_700_000_000,
      label_values: [{ label: ' username ', value: 'sample_user_e' }],
    };
    // The label resolver hands back the label string exactly as the archive
    // spells it, so no second normalisation happens here.
    expect(resolveEntry(entry, ' username ')?.username).toBe('sample_user_e');
    expect(resolveEntry(entry, 'username')).toBeNull();
  });

  it('never stores the URL label as href — it is the profile bio link', () => {
    // Observed in the real removed_suggestions.json: a third-party scheduling
    // link. Storing it as href would aim a profile click off Instagram.
    const entry = {
      timestamp: 1_700_000_000,
      label_values: [
        { label: 'URL', value: 'https://example.com/some/booking/page' },
        { label: 'Username', value: 'sample_user_f' },
      ],
    };
    expect(resolveEntry(entry, 'Username')).toEqual({
      username: 'sample_user_f',
      timestamp: 1_700_000_000,
    });
    expect(resolveEntry(entry, 'Username')?.href).toBeUndefined();
  });

  it('returns null for a label_values entry when no label was resolved', () => {
    const entry = {
      timestamp: 1_700_000_000,
      label_values: [{ label: 'Username', value: 'sample_user_g' }],
    };
    expect(resolveEntry(entry, null)).toBeNull();
  });

  it('returns null when the resolved label holds a value that is not username-shaped', () => {
    const entry = { label_values: [{ label: 'Username', value: 'not a username at all' }] };
    expect(resolveEntry(entry, 'Username')).toBeNull();
  });

  it('returns null for shapes it does not recognise', () => {
    expect(resolveEntry({ some_other_key: 'x' }, 'Username')).toBeNull();
    expect(resolveEntry(null, 'Username')).toBeNull();
    expect(resolveEntry(42, 'Username')).toBeNull();
  });
});

describe('resolveEntries', () => {
  it('dedupes by username, keeping the first occurrence', () => {
    const entries = [
      { title: 'sample_user_h', string_list_data: [{ href: 'first', value: 'sample_user_h' }] },
      { title: 'sample_user_h', string_list_data: [{ href: 'second', value: 'sample_user_h' }] },
    ];
    const resolved = resolveEntries(entries, null);
    expect(resolved.items).toHaveLength(1);
    expect(resolved.items[0]?.href).toBe('first');
  });

  it('counts entries it could not read instead of dropping them silently', () => {
    // The count is the whole contract with the entry-level diagnostics
    // (Task 3): an unreadable entry must leave a trace, or a drifted export
    // produces a confidently wrong answer again.
    const entries = [
      { title: 'sample_user_i' },
      { label_values: [{ label: 'Username', value: 'sample_user_j' }] },
      { some_other_key: 'x' },
    ];
    expect(resolveEntries(entries, null)).toEqual({
      items: [{ username: 'sample_user_i', href: undefined, timestamp: undefined }],
      unresolved: 2,
    });
  });

  it('resolves label_values entries once a label is supplied', () => {
    const entries = [
      { timestamp: 1_700_000_000, label_values: [{ label: 'Username', value: 'sample_user_k' }] },
      { timestamp: 1_700_000_001, label_values: [{ label: 'Username', value: 'sample_user_l' }] },
    ];
    const resolved = resolveEntries(entries, 'Username');
    expect(resolved.items.map(i => i.username)).toEqual(['sample_user_k', 'sample_user_l']);
    expect(resolved.unresolved).toBe(0);
  });

  it('returns an empty result for undefined', () => {
    expect(resolveEntries(undefined, null)).toEqual({ items: [], unresolved: 0 });
  });
});
