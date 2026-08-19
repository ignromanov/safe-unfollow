import { FollowRequestsCaveat } from 'safe-unfollow';

// No props — every string comes from i18n (`results.caveat.followRequests.*`).
// Shown on /results whenever the follow-requests file couldn't be read (GH#41),
// so "Not following back" may include accounts the user actually requested.
export function Default() {
  return <FollowRequestsCaveat />;
}
