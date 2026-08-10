import { ResultsSection, FilterChips } from 'safe-unfollow';

// ResultsSection has no real caller in src/ (superseded by
// AccountListSection.tsx — see learnings). Composed here straight from its
// own shipped prop contract: `children` is a plain `<aside>` slot, and a
// filter sidebar is the obvious real content for it.
const filterCounts = {
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

export function Default() {
  return (
    <ResultsSection
      totalCount={842}
      filteredCount={330}
      stats={{ following: 842, followers: 615, mutuals: 512, notFollowingBack: 330 }}
    >
      <FilterChips
        selectedFilters={new Set(['notFollowingBack'])}
        onFiltersChange={() => {}}
        filterCounts={filterCounts}
      />
    </ResultsSection>
  );
}

// filteredCount === totalCount — the "Showing X of Y" line collapses to a
// single number implicitly (X and Y match) instead of reading as a filter.
export function NoFiltersApplied() {
  return (
    <ResultsSection
      totalCount={842}
      filteredCount={842}
      stats={{ following: 842, followers: 615, mutuals: 512, notFollowingBack: 330 }}
    >
      <FilterChips
        selectedFilters={new Set()}
        onFiltersChange={() => {}}
        filterCounts={filterCounts}
      />
    </ResultsSection>
  );
}
