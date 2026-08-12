/**
 * Instagram Label Resolution
 *
 * The 2026-08 export puts every field of a relationship record behind a label:
 * `{ label: "Username", value: "..." }`. The label is **localised** — the same
 * account exported twice on the same day spelled it `Username` in English and
 * as a Russian phrase in Russian (`raw/connections-2026-08-11{,-ru}`) — so the
 * username field cannot be found by name. It is identified here by how its
 * values behave across the archive.
 *
 * The Russian spelling is deliberately not quoted anywhere in this file. Every
 * such quotation is a copy-paste away from becoming a special case.
 *
 * No table of translated labels. It would need Instagram's ~30 export
 * languages rather than our 10 locales, it breaks silently the day Meta
 * rewords a string, and the scoring below subsumes it with no maintenance
 * surface. A guard test asserts these sources stay ASCII outside comments,
 * because reaching for the literal is the obvious first move when a
 * non-English fixture fails.
 *
 * Two further things the real archives teach:
 *
 * 1. Non-ASCII labels arrive **double-encoded** — the UTF-8 bytes of the label,
 *    each taken as a codepoint — so `JSON.parse` yields mojibake, not readable
 *    text. Irrelevant to the code below, which treats the label as an opaque
 *    key, and fatal to any approach that compares it to a written-out string.
 * 2. Scoring must pool the whole archive. `restricted_profiles.json` and
 *    `removed_suggestions.json` hold a single record each, where a display
 *    name and a username can both look like usernames and the margin vanishes.
 */

import type { InstagramLabelValue, InstagramLabelValueEntry } from '@/core/types';
import { normalize } from './instagram-utils';

/**
 * The one language-specific string allowed here, and it is the source
 * language of the format itself. Covers every English export at zero cost.
 */
const USERNAME_LABEL_FAST_PATH = 'username';

/** A winner must look like a username essentially always, not merely often. */
const MIN_WINNER_RATE = 0.9;

/**
 * ...and must beat the runner-up by this factor. Measured on the Russian
 * archive (`raw/connections-2026-08-11-ru`, six relationship files pooled):
 * the username label scored 47/47, the display-name label 8/45, the URL label
 * 0/13. A wide, stable margin — but the display name alone produced eight
 * username-shaped values, which is why a per-entry guess is forbidden and only
 * the population statistic is trusted.
 */
const MIN_RUNNER_UP_RATIO = 2;

interface LabelTally {
  /** Non-empty values under this label that are shaped like usernames. */
  valid: number;
  /** Non-empty values under this label. Empty ones carry no signal. */
  scored: number;
}

/**
 * Resolve which label holds the username, for one archive.
 *
 * Pass every entry from every relationship file at once — per-file resolution
 * fails on the single-record files (see the note above). Returns the label
 * spelled exactly as the archive spells it, padding and casing included, so
 * `resolveEntry` can match it without a second normalisation the two could
 * drift apart on.
 *
 * `null` means "no clear winner". Callers must then leave entries unresolved
 * and count them, never fall back to picking the first username-shaped value
 * in a record.
 *
 * **Scope seam.** Today this is called from `parseOptionalFiles` and therefore
 * pools the six optional files only; `following.json` and `followers_*.json`
 * are read elsewhere and have not migrated to this entry shape yet. The same
 * serialiser has been rolling across Meta's products since 2024, so when they
 * do migrate, this needs a pass spanning all eight files — the pass does not
 * exist yet and this comment is the marker for building it.
 */
export function resolveUsernameLabel(entries: readonly unknown[]): string | null {
  const tallies = tallyLabels(entries);

  for (const label of tallies.keys()) {
    if (label.trim().toLowerCase() === USERNAME_LABEL_FAST_PATH) return label;
  }

  return pickWinner(tallies);
}

/** Count, per label, how many of its non-empty values look like usernames. */
function tallyLabels(entries: readonly unknown[]): Map<string, LabelTally> {
  const tallies = new Map<string, LabelTally>();

  for (const entry of entries) {
    for (const pair of labelValuesOf(entry)) {
      const label = pair?.label;
      if (typeof label !== 'string') continue;

      // Recorded even with no scorable values, so a `Username` label whose
      // values happen to be empty still reaches the fast path.
      const tally = tallies.get(label) ?? { valid: 0, scored: 0 };
      tallies.set(label, tally);

      if (typeof pair.value !== 'string' || !pair.value.trim().length) continue;
      tally.scored += 1;
      // Deliberately the same predicate `resolveEntry` reads values with:
      // a label can only win on values that will actually be accepted.
      if (normalize(pair.value) !== null) tally.valid += 1;
    }
  }

  return tallies;
}

/**
 * The clear-winner rule. Ambiguity resolves to `null` rather than to a guess:
 * a wrong label does not fail loudly, it invents accounts.
 *
 * There is no tiebreak against `following ∪ followers` as a second opinion.
 * Measured on the real archives, the correct label reaches only 76.9%
 * (English) and 30.3% (Russian) membership in those sets, because
 * `recently_unfollowed_profiles.json` lists precisely the accounts that are no
 * longer in `following.json`. It would need a threshold looser than the one
 * above, invented for the single path whose purpose is not to guess — and it
 * fires on neither archive, both of which resolve here.
 */
function pickWinner(tallies: ReadonlyMap<string, LabelTally>): string | null {
  const ranked = [...tallies]
    .filter(([, tally]) => tally.scored > 0)
    .map(([label, tally]) => ({ label, rate: tally.valid / tally.scored }))
    .sort((left, right) => right.rate - left.rate);

  const winner = ranked[0];
  if (!winner || winner.rate < MIN_WINNER_RATE) return null;

  const runnerUp = ranked[1];
  if (runnerUp && winner.rate < runnerUp.rate * MIN_RUNNER_UP_RATIO) return null;

  return winner.label;
}

function labelValuesOf(entry: unknown): readonly InstagramLabelValue[] {
  if (typeof entry !== 'object' || entry === null) return [];
  const values = (entry as InstagramLabelValueEntry).label_values;
  return Array.isArray(values) ? values : [];
}
