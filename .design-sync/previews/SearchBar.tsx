import { SearchBar } from 'safe-unfollow';

// Real idle state from ResultsSection: empty query, full result set, a
// processing time already measured from the initial (unfiltered) render.
export function Empty() {
  return (
    <div className="max-w-sm">
      <SearchBar
        value=""
        onChange={() => {}}
        resultCount={1842}
        totalCount={1842}
        processingTime={2}
      />
    </div>
  );
}

// Narrowed results — the clear ("X") button only renders when value is
// truthy, so this is the only cell that shows it.
export function Filtered() {
  return (
    <div className="max-w-sm">
      <SearchBar
        value="maria"
        onChange={() => {}}
        resultCount={47}
        totalCount={1842}
        processingTime={1.3}
      />
    </div>
  );
}

// Mid-keystroke: the loader swaps in for the search icon and the "Xms"
// timing is suppressed until isFiltering clears (SearchBar.tsx's own
// `!isFiltering` guard).
export function Filtering() {
  return (
    <div className="max-w-sm">
      <SearchBar
        value="trav"
        onChange={() => {}}
        resultCount={47}
        totalCount={1842}
        isFiltering={true}
      />
    </div>
  );
}
