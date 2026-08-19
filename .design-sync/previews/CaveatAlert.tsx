import { CaveatAlert } from 'safe-unfollow';

// The amber shell both /results caveats render in. It supplies the palette, the
// warning icon and `role="status"` (an accessibility override of Alert's default
// `role="alert"` — these are inserted after paint and must not interrupt a screen
// reader); a caveat supplies only its own two strings.
//
// Copy below is the shipped English text from `results.caveat.*`, since the shell
// itself reads no i18n — its consumers pass translated nodes in.

export function FollowRequestsNotice() {
  return (
    <div className="max-w-2xl">
      <CaveatAlert
        title="“Not following back” may be overstated."
        body="We could not read your follow-requests file, so accounts you have requested may appear in this list, and your pending-request counts show as empty. Your Followers, Following and Mutuals are unaffected."
      />
    </div>
  );
}

// AlertTitle ships `line-clamp-1`; the shell overrides it with `line-clamp-none`
// precisely so a caveat's headline is never truncated into a half-sentence.
export function LongTitleWraps() {
  return (
    <div className="max-w-sm">
      <CaveatAlert
        title="Your followers list looks incomplete, so four of the counts on this page are wrong."
        body="Ask Instagram for your data again with the date range set to “All time”."
      />
    </div>
  );
}
