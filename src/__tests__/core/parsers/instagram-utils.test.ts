import { describe, it, expect } from 'vitest';
import { resolveEntryList } from '@/core/parsers/instagram-utils';

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
