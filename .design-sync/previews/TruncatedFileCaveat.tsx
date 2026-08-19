import { TruncatedFileCaveat } from 'safe-unfollow';

// Fires when Meta's export dialog was given a date range: one relationship file
// arrives filtered and the other whole, which silently skews four counts on
// /results (measured on a real export: notFollowingBack 95 -> 294, mutuals
// 298 -> 99). Strings come from `results.caveat.truncated.*` via the preview
// provider's i18n instance — the component takes only which file was short.
//
// The prop's third value, `null`, renders nothing by design (the component
// self-guards rather than being conditioned by its caller), so it has no card.

export function FollowersTruncated() {
  return (
    <div className="max-w-2xl">
      <TruncatedFileCaveat truncated="followers" />
    </div>
  );
}

export function FollowingTruncated() {
  return (
    <div className="max-w-2xl">
      <TruncatedFileCaveat truncated="following" />
    </div>
  );
}
