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
 * Two further notes:
 *
 * 1. Measured on both August archives: non-ASCII labels arrive
 *    **double-encoded** — the UTF-8 bytes of the label, each taken as a
 *    codepoint — so `JSON.parse` yields mojibake, not readable text.
 *    Irrelevant to the code below, which treats the label as an opaque key,
 *    and fatal to any approach that compares it to a written-out string.
 * 2. Scoring pools the whole archive **defensively**. That is a judgement, not
 *    a repair: measured per file, every optional file in both August archives
 *    resolves standalone, including the two that hold a single record. Pooling
 *    covers the case those files cannot survive — a display name that is
 *    itself username-shaped, which leaves one record scoring 1/1 against 1/1.
 */

import type {
  InstagramLabelValue,
  InstagramLabelValueEntry,
  LabelResolutionMode,
} from '@/core/types';
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

/**
 * ...and may only rank at all once it carries this share of the best-covered
 * label's scorable values. The username is written on every record — it is
 * what identifies the account — so a label populated on a fraction of the pool
 * cannot be it, and must not be allowed to tie with it. Without this floor a
 * `URL` label holding two link-in-bio values scores a perfect 2/2, ties the
 * true winner's 47/47, fails `MIN_RUNNER_UP_RATIO` and returns `null` for the
 * **whole archive**, including the two files that feed `notFollowingBack`.
 * `normalize` accepts a bare domain, so that input is reachable.
 *
 * Relative, with no absolute minimum: an absolute floor would refuse an
 * archive whose six optional files hold two records between them — the same
 * silent collapse in a smaller place. Half is the widest cut that still leaves
 * two equally populated labels tied, which is the ambiguity this must refuse.
 */
const MIN_POOL_COVERAGE = 0.5;

export interface LabelResolutionContext {
  /**
   * Entries from the files flagged `FileSpec.impliesKnownAccount` — those
   * whose accounts can hit `following ∪ followers` without scoring the correct
   * label to zero. A subset of the scoring pool, deliberately not all of it.
   */
  tiebreakEntries?: readonly unknown[];
  /**
   * `following ∪ followers`, normalised the same way usernames are everywhere
   * else. Absent or empty leaves the tiebreak inert — never crashing, never
   * guessing — which is what an unreadable `following.json` must degrade to.
   *
   * A thunk, not the set: it is read only by `pickByMembership`, which the two
   * stages above it reach past on every archive measured so far. Materialising
   * it eagerly would union both required files — the only two that reach the
   * app's 1M-account ceiling — on every parse, to be discarded unread.
   */
  knownUsernames?: () => ReadonlySet<string>;
}

interface LabelTally {
  /** Non-empty values under this label that are shaped like usernames. */
  valid: number;
  /** Non-empty values under this label. Empty ones carry no signal. */
  scored: number;
}

/** Which label holds the username, and how that was decided. */
export interface LabelResolutionResult {
  label: string | null;
  mode: LabelResolutionMode;
}

/**
 * Resolve which label holds the username, for one archive.
 *
 * Pass every entry from every relationship file at once — a small file can be
 * ambiguous on its own even though none on disk is (see note 2). Returns the label
 * spelled exactly as the archive spells it, padding and casing included, so
 * `resolveEntry` can match it without a second normalisation the two could
 * drift apart on.
 *
 * A `label` of `null` means "no clear winner". Callers must then leave entries
 * unresolved and count them, never fall back to picking the first
 * username-shaped value in a record.
 *
 * `mode` is the signal `useFileUpload` reports to telemetry as
 * `usernameLabelResolution` (GH#21 Task 5). It is returned alongside the label
 * rather than from a second entry point: the only production caller wants both,
 * and a label-only wrapper beside this one ended up with no caller at all.
 *
 * **Scope seam.** Today this is called from `parseOptionalFiles` and therefore
 * pools the six optional files only; `following.json` and `followers_*.json`
 * are read elsewhere and have not migrated to this entry shape yet. The same
 * serialiser has been rolling across Meta's products since 2024, so when they
 * do migrate, this needs a pass spanning all eight files — the pass does not
 * exist yet and this comment is the marker for building it.
 *
 * `not-applicable` vs `unresolved` is read off `tallies`, not off `entries`
 * directly: `tallyLabels` already discards non-object entries and pairs whose
 * `label` isn't a string, so an empty `tallies` map means no entry anywhere
 * in the pool carried a recognizable `label_values` pair — the honest
 * "nothing to resolve" case — while a non-empty map with no winner means
 * labels existed and genuinely tied or missed the threshold.
 */
export function resolveUsernameLabelWithMode(
  entries: readonly unknown[],
  context: LabelResolutionContext = {}
): LabelResolutionResult {
  const tallies = tallyLabels(entries);

  for (const label of tallies.keys()) {
    if (label.trim().toLowerCase() === USERNAME_LABEL_FAST_PATH) {
      return { label, mode: 'fast-path' };
    }
  }

  const scored = pickWinner(tallies);
  if (scored !== null) return { label: scored, mode: 'inferred' };

  const tiebreak = pickByMembership(context.tiebreakEntries ?? [], context.knownUsernames);
  if (tiebreak !== null) return { label: tiebreak, mode: 'inferred' };

  return { label: null, mode: tallies.size === 0 ? 'not-applicable' : 'unresolved' };
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
 * The clear-winner rule. Ambiguity falls through to the membership tiebreak
 * below rather than to a guess: a wrong label does not fail loudly, it invents
 * accounts.
 */
function pickWinner(tallies: ReadonlyMap<string, LabelTally>): string | null {
  const maxScored = Math.max(0, ...[...tallies.values()].map(tally => tally.scored));
  const minScored = maxScored * MIN_POOL_COVERAGE;

  const ranked = [...tallies]
    .filter(([, tally]) => tally.scored > 0 && tally.scored >= minScored)
    .map(([label, tally]) => ({ label, rate: tally.valid / tally.scored }))
    .sort((left, right) => right.rate - left.rate);

  const winner = ranked[0];
  if (!winner || winner.rate < MIN_WINNER_RATE) return null;

  const runnerUp = ranked[1];
  if (runnerUp && winner.rate < runnerUp.rate * MIN_RUNNER_UP_RATIO) return null;

  return winner.label;
}

/**
 * Second opinion when value shape cannot separate two labels: which label's
 * values are accounts the user demonstrably has a relationship with?
 *
 * Scored by **count**, not rate. Every label appears once per entry, so the
 * denominators are equal and counts give the same ranking with less
 * small-sample noise. The winner must have strictly more hits than every other
 * candidate; a tie at the top resolves nothing, and a board where nobody
 * scores resolves nothing — `hits` only ever records a hit, so an empty map is
 * exactly the all-zero case.
 *
 * **The threshold is a judgement, not a measurement.** No archive on disk
 * reaches this function: the English export resolves at the fast path and the
 * Russian one at scoring (100% against 17.8%). It exists for the archive where
 * scoring is genuinely ambiguous. What justifies "strictly better with at
 * least one hit" is the separation shape it is built for — on both August
 * archives the correct label scores 8 here and every other label scores 0, a
 * gap no percentage threshold reads better than a comparison does.
 *
 * `entries` must come only from files whose `impliesKnownAccount` is set.
 * `recently_unfollowed` is the trap: those accounts were unfollowed, so they
 * are gone from `following.json` by definition, and pooling them in scores the
 * correct label 0/2 (English) and 0/22 (Russian) against noise.
 */
function pickByMembership(
  entries: readonly unknown[],
  readKnownUsernames?: () => ReadonlySet<string>
): string | null {
  const knownUsernames = readKnownUsernames?.();
  if (!knownUsernames || knownUsernames.size === 0) return null;

  const hits = new Map<string, number>();
  for (const entry of entries) {
    for (const pair of labelValuesOf(entry)) {
      const label = pair?.label;
      if (typeof label !== 'string') continue;
      const username = normalize(pair.value);
      if (username === null || !knownUsernames.has(username)) continue;
      hits.set(label, (hits.get(label) ?? 0) + 1);
    }
  }

  const ranked = [...hits].sort(([, left], [, right]) => right - left);
  const winner = ranked[0];
  if (!winner) return null;

  const runnerUp = ranked[1];
  if (runnerUp && runnerUp[1] >= winner[1]) return null;

  return winner[0];
}

function labelValuesOf(entry: unknown): readonly InstagramLabelValue[] {
  if (typeof entry !== 'object' || entry === null) return [];
  const values = (entry as InstagramLabelValueEntry).label_values;
  return Array.isArray(values) ? values : [];
}
