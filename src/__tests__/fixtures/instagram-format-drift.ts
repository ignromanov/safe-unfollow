/**
 * Fixtures for GH#21: relationship files whose top-level SHAPE we don't
 * recognize must not silently parse into an empty Set/Map, indistinguishable
 * from a genuinely empty file.
 *
 * Each "drift" fixture below is a payload where neither known shape branch
 * matches (top-level array, or `{ <propCandidate>: [...] }`). Each "regression"
 * fixture is a payload that DOES match a known shape and must keep the old
 * behavior (empty 'info' warning, no drift error).
 */

/** One valid Instagram export entry (old format: username in string_list_data[0].value). */
export function makeEntry(username: string, timestamp = 1_700_000_000) {
  return {
    title: username,
    string_list_data: [
      {
        href: `https://www.instagram.com/${username}/`,
        value: username,
        timestamp,
      },
    ],
    media_list_data: [],
  };
}

/** A single valid entry, top-level bare-array shape. */
export const VALID_ARRAY_OF_ONE = [makeEntry('validuser')];

/** Recognized shape (bare array), genuinely empty — must stay 'info', not drift. */
export const EMPTY_ARRAY: unknown[] = [];

/** Recognized shape (bare array), but no entry yields a recognizable username. */
export const ARRAY_NO_USERNAME_FIELD = [{ media_list_data: [] }];

/** Unknown top-level key — neither an array nor any known relationships_* property. */
export const UNKNOWN_TOP_LEVEL_KEY = { some_other_key: [makeEntry('ghost')] };

/** Null payload — JSON `null`. */
export const NULL_PAYLOAD = null;

/** Object instead of array — the expected property exists but isn't an array. */
export function objectInsteadOfArray(propName: string) {
  return { [propName]: { not: 'an array' } };
}
