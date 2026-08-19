import { UserPlus, Users, XCircle, TrendingDown } from 'lucide-react';
import { StatCard } from 'safe-unfollow';

// Real layout from AccountListSection.tsx: 4 cards in a grid, each bound to a
// badge filter. "Unfollowed" active mirrors clicking that filter chip on.
export function Overview() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      <StatCard
        icon={<UserPlus size={24} />}
        label="Followers"
        value={1284}
        colorClass="bg-emerald-500/10 text-emerald-500"
        badgeType="followers"
        isActive={false}
        onClick={() => {}}
      />
      <StatCard
        icon={<Users size={24} />}
        label="Following"
        value={1530}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={() => {}}
      />
      <StatCard
        icon={<XCircle size={24} />}
        label="Unfollowed"
        value={212}
        colorClass="bg-rose-500/10 text-rose-500"
        badgeType="unfollowed"
        isActive={true}
        onClick={() => {}}
      />
      <StatCard
        icon={<TrendingDown size={24} />}
        label="Not Following"
        value={346}
        colorClass="bg-amber-500/10 text-amber-500"
        badgeType="notFollowingBack"
        isActive={false}
        onClick={() => {}}
      />
    </div>
  );
}

// Active vs. inactive side by side — the active state swaps the whole card to
// the primary color, not just the icon chip, so it needs its own cell to read.
export function ActiveVsInactive() {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-md">
      <StatCard
        icon={<Users size={24} />}
        label="Following"
        value={1530}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={() => {}}
      />
      <StatCard
        icon={<Users size={24} />}
        label="Following"
        value={1530}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={true}
        onClick={() => {}}
      />
    </div>
  );
}
