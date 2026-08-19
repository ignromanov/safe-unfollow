import { FilterChips } from 'safe-unfollow';

// Full 11-key count map (real prop type is Record<BadgeKey, number>, no
// partial). Shared across cells; only selectedFilters / individual counts
// vary per story.
const baseCounts = {
  following: 842,
  followers: 615,
  mutuals: 512,
  notFollowingBack: 330,
  notFollowedBack: 103,
  unfollowed: 58,
  pending: 4,
  permanent: 2,
  restricted: 6,
  close: 21,
  dismissed: 0,
};

// Default: no filters selected, `dismissed` is empty so the "Empty
// Categories" collapsed section appears under the populated grid.
export function Default() {
  return (
    <div className="w-72">
      <FilterChips
        selectedFilters={new Set()}
        onFiltersChange={() => {}}
        filterCounts={baseCounts}
      />
    </div>
  );
}

// Active filters swap the chip to the solid primary fill + white text/count
// pill, and reveal the "Reset" action next to the header.
export function WithActiveFilters() {
  return (
    <div className="w-72">
      <FilterChips
        selectedFilters={new Set(['unfollowed', 'notFollowingBack', 'close'])}
        onFiltersChange={() => {}}
        filterCounts={baseCounts}
      />
    </div>
  );
}

// Every category populated — the empty-categories section (and its toggle)
// disappears entirely rather than rendering with a zero count.
export function AllPopulated() {
  return (
    <div className="w-72">
      <FilterChips
        selectedFilters={new Set()}
        onFiltersChange={() => {}}
        filterCounts={{ ...baseCounts, dismissed: 3, permanent: 9 }}
      />
    </div>
  );
}
