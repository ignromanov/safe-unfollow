/**
 * Detects that one of the two required relationship files was cut short.
 *
 * Meta's export dialog offers a date range, and choosing one filters
 * `followers_*.json` by entry timestamp while leaving `following.json` whole.
 * Nothing in the archive says so: the file is present, well-formed, parses
 * cleanly, and simply contains fewer people than it should. Every follower
 * removed that way becomes an account the reader is told does not follow them
 * back — the single worst answer this tool can give, and the one it gives most
 * confidently.
 *
 * Measured on one account's own exports two days apart, same following list
 * both times: followers 364 -> 118, and `notFollowingBack` 95 -> 294. Of 298
 * real mutuals, 199 were accused. `hasMinimalData` was true, no warning fired,
 * and the upload was recorded as a success.
 *
 * What this cannot do is prove Meta did it. A genuinely late-blooming account —
 * one that followed hundreds of people years before anyone followed back —
 * produces the same shape. So the detector reports the *observation* and the UI
 * names the one action that resolves it (request the export again over all
 * time). A false positive costs a paragraph of explanation; a false negative
 * costs 199 wrong accusations the reader has no way to notice.
 */

/** Which of the two required lists starts materially later than the other. */
export type TruncatedRelationshipFile = 'followers' | 'following' | null;

/**
 * How far apart the two lists may start before it is worth saying so.
 *
 * Not fitted to the measured exports. Those come from a single account, and a
 * threshold tuned to them would be tuned to one person's history. This is the
 * smallest gap that Meta's own presets can open — its shortest range is a week,
 * its next is a month — while still being too wide to explain by the order in
 * which an account is set up. Someone can plausibly follow a few people before
 * anyone follows them, or the reverse, within weeks; half a year of one-sided
 * silence is a different claim.
 *
 * Measured margin, for whoever revisits this: six healthy exports of one
 * account sit at -60 days, to the second, across a year. The date-filtered one
 * sits at +4071.
 */
export const SKEW_THRESHOLD_DAYS = 180;

/**
 * Below this many usable timestamps in either list, the comparison is noise.
 *
 * The statistic is the oldest entry, so a list of three says almost nothing
 * about when the account began.
 */
export const MIN_TIMESTAMPS_FOR_SKEW = 10;

const SECONDS_PER_DAY = 86_400;

/**
 * The earliest real timestamp, or null when there are too few to trust.
 *
 * Zeros are skipped rather than counted: both parsers store `r.timestamp ?? 0`,
 * so a record Instagram exported without a date is a zero here, not an absence.
 * Treating those as 1970 would make every export look like it began at the
 * epoch and fire this detector on all of them.
 */
function oldestTimestamp(timestamps: ReadonlyMap<string, number>): number | null {
  let usable = 0;
  let oldest = Number.POSITIVE_INFINITY;

  for (const timestamp of timestamps.values()) {
    if (timestamp <= 0) continue;
    usable++;
    if (timestamp < oldest) oldest = timestamp;
  }

  return usable >= MIN_TIMESTAMPS_FOR_SKEW ? oldest : null;
}

/**
 * Compares where the two lists begin and names the short one, if either.
 *
 * The oldest entry is used rather than a percentile, and that choice was made
 * against the data rather than by taste. A low percentile is the more robust
 * statistic in general — one stray survivor cannot move it — but it is a
 * property of the *distribution*, and the two lists have legitimately different
 * distributions: an account can gain followers faster than it follows, or the
 * reverse. Measured on six healthy exports, the fifth percentile put the two
 * lists 455 to 491 days apart, past this threshold, and would have fired on
 * every one of them. The oldest entry is a fixed point of the account's history
 * instead, and stayed at -60 days across all six.
 *
 * @returns which list is short, or null when the two begin close enough
 *   together, or when either is too small to judge.
 */
export function detectRelationshipSkew(
  followingTimestamps: ReadonlyMap<string, number>,
  followersTimestamps: ReadonlyMap<string, number>
): TruncatedRelationshipFile {
  const followingOldest = oldestTimestamp(followingTimestamps);
  const followersOldest = oldestTimestamp(followersTimestamps);

  if (followingOldest === null || followersOldest === null) return null;

  const skewSeconds = followersOldest - followingOldest;
  if (Math.abs(skewSeconds) < SKEW_THRESHOLD_DAYS * SECONDS_PER_DAY) return null;

  return skewSeconds > 0 ? 'followers' : 'following';
}
