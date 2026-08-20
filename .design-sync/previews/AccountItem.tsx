import { AccountItem } from 'safe-unfollow';

// Real containing card from AccountList.tsx: `bg-card rounded-4xl border
// border-border shadow-sm overflow-hidden`. AccountItem itself only owns its
// own row (border-b, last:border-0) — it needs this wrapper to look real.
//
// Width is `max-w-2xl`, not the real component's narrower feel: AccountItem's
// badge row is `overflow-x-auto` — real users scroll it, but a static capture
// only ever shows the initial scroll position, so an under-width wrapper
// clips a badge to an unreadable colour sliver instead of demonstrating it.
// `max-w-md` clipped 3+ badges on capture; the real containing card is
// `flex-grow` inside the results page's content column anyway, which runs
// far wider than either on desktop.

export function MutualFollow() {
  return (
    <div className="max-w-2xl bg-card rounded-4xl border border-border shadow-sm overflow-hidden">
      <AccountItem
        account={{
          username: 'sara.wanders',
          badges: { following: true, followers: true, mutuals: true },
        }}
        index={0}
        totalCount={1}
      />
    </div>
  );
}

// The `unfollowed` badge is the one BADGE_STYLES entry with extra `font-bold`
// — worth its own cell since it doesn't read like the others at a glance.
export function RecentlyUnfollowed() {
  return (
    <div className="max-w-2xl bg-card rounded-4xl border border-border shadow-sm overflow-hidden">
      <AccountItem
        account={{
          username: 'mike_creates',
          badges: { following: true, unfollowed: 1732147200 },
        }}
        index={0}
        totalCount={1}
      />
    </div>
  );
}

export function CloseFriendNotFollowingBack() {
  return (
    <div className="max-w-2xl bg-card rounded-4xl border border-border shadow-sm overflow-hidden">
      <AccountItem
        account={{
          username: 'devon.codes',
          badges: { following: true, notFollowingBack: true, close: true },
        }}
        index={0}
        totalCount={1}
      />
    </div>
  );
}

// Multiple stacked rows — the only way to show the border-b separator between
// rows and its removal on the last one (last:border-0).
export function ListRows() {
  return (
    <div className="max-w-2xl bg-card rounded-4xl border border-border shadow-sm overflow-hidden">
      <AccountItem
        account={{
          username: 'ln.travel_journal',
          badges: { followers: true, notFollowedBack: true },
        }}
        index={0}
        totalCount={3}
      />
      <AccountItem
        account={{ username: 'priya.designs', badges: { following: true, pending: true } }}
        index={1}
        totalCount={3}
      />
      <AccountItem
        account={{
          username: 'noah.builds',
          badges: { following: true, followers: true, mutuals: true, restricted: true },
        }}
        index={2}
        totalCount={3}
      />
    </div>
  );
}
