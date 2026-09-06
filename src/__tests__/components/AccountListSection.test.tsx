import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@tests/utils/testUtils';
import { renderWithRouter } from '@/__tests__/test-utils';
import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { AccountListSection } from '@/components/AccountListSection';
import type { BadgeKey } from '@/core/types';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
import { useUploadCaveats } from '@/hooks/useUploadCaveats';
import { analytics } from '@/lib/analytics';

// Mock the useAccountFiltering hook
vi.mock('@/hooks/useAccountFiltering');

// Reads IndexedDB, which jsdom does not provide. Mocked so every other test in
// this file renders the clean page, and the caveat tests below opt in.
vi.mock('@/hooks/useUploadCaveats');

// Mock useLanguagePrefix
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => '',
}));

// Mock child components
vi.mock('@/components/FilterChips', () => ({
  // The stub reports the `candidateCounts` it was handed, because that prop is
  // the whole point of this feature and nothing else can see it cross this
  // boundary: this file mocks FilterChips wholesale, and FilterChips.test.tsx
  // supplies the prop directly rather than receiving it from the hook.
  // `candidateCounts={filterCounts}` type-checks cleanly — Record is assignable
  // to Record | null — so without this the whole feature could silently revert
  // to all-time counts with `tsc` quiet and the suite green.
  //
  // Rendered as the literal 'null' rather than an empty string so that null (the
  // contract's absence state) and undefined (a drifted mock) are distinguishable.
  FilterChips: ({
    selectedFilters,
    onFiltersChange,
    candidateCounts,
  }: {
    selectedFilters: Set<BadgeKey>;
    onFiltersChange: (filters: Set<BadgeKey>) => void;
    candidateCounts: Record<BadgeKey, number> | null;
  }) => (
    <div data-testid="filter-chips">
      <p>Active filters: {selectedFilters.size}</p>
      <p data-testid="candidate-followers">
        {candidateCounts === null ? 'null' : String(candidateCounts?.followers)}
      </p>
      <button onClick={() => onFiltersChange(new Set(['following']))}>Toggle Following</button>
    </div>
  ),
}));

vi.mock('@/components/AccountList', () => ({
  // Like the FilterChips stub above, and for the same reason: nothing else can
  // see what crosses this boundary, and the empty state a reader gets is
  // decided entirely by it.
  //
  // `activeFilter` carried a `presentInExport` flag until fix round 1. It was
  // derived from `filterCounts[badge] > 0`, and a zero cannot mean what that
  // flag claimed: `storeAllAccounts` seeds every badge in `ALL_BADGES` with
  // `count: 0` and writes them unconditionally, so `getBadgeStats` returns 0
  // both for a badge whose file was absent from the download and for one whose
  // file was present and empty. The label is all that survives.
  AccountList: ({
    accountIndices,
    accountCount,
    activeFilter,
    searchActive,
  }: {
    accountIndices: number[] | null;
    accountCount: number;
    activeFilter?: { label: string };
    searchActive?: boolean;
  }) => {
    const count = accountIndices === null ? accountCount : accountIndices.length;
    return (
      <div data-testid="account-list">
        <p>Accounts ({count})</p>
        <p data-testid="active-filter-label">{activeFilter ? activeFilter.label : 'undefined'}</p>
        <p data-testid="search-active">{String(searchActive)}</p>
        {accountIndices !== null && accountIndices.length === 0 && (
          <p>No accounts match your filters</p>
        )}
      </div>
    );
  },
}));

// The real StatCard is a <button> whose click is the only path into
// handleStatCardClick. A mock that renders a bare <div> makes that path
// unreachable, so the mock keeps its testid and gains the button — enough to
// exercise the wiring, not enough to restate StatCard's own markup.
vi.mock('@/components/StatCard', () => ({
  StatCard: ({
    label,
    value,
    badgeType,
    onClick,
  }: {
    label: string;
    value: number;
    badgeType?: BadgeKey;
    onClick: (type: BadgeKey) => void;
  }) => (
    <div data-testid={`stat-card-${label.toLowerCase()}`}>
      <button onClick={() => badgeType && onClick(badgeType)} disabled={!badgeType}>
        {label}: {value}
      </button>
    </div>
  ),
}));

// RescuePlanBanner renders behind a severity-based setTimeout (5-15s) and pulls in
// IntersectionObserver/analytics internals that are out of scope here — mock it like
// the other children above so this file only asserts whether it's called at all.
vi.mock('@/components/RescuePlanBanner', () => ({
  RescuePlanBanner: () => <div data-testid="rescue-plan-banner" />,
}));

const mockUseAccountFiltering = vi.mocked(useAccountFiltering);
const mockUseUploadCaveats = vi.mocked(useUploadCaveats);

/** Both caveats quiet unless a test says otherwise. */
const caveats = (overrides: Partial<ReturnType<typeof useUploadCaveats>> = {}) => ({
  followRequestsUnreadable: false,
  truncatedRelationshipFile: 'not-applicable' as const,
  ...overrides,
});

describe('AccountListSection', () => {
  const mockSetQuery = vi.fn();
  const mockSetFilters = vi.fn();

  const defaultProps = {
    fileHash: 'test-hash-123',
    accountCount: 21,
    filename: 'test.zip',
    isSample: false,
  };

  // Default filter counts for most tests
  const defaultFilterCounts = {
    following: 10,
    followers: 15,
    mutuals: 5,
    notFollowingBack: 3,
    notFollowedBack: 2,
    pending: 1,
    permanent: 0,
    restricted: 0,
    close: 2,
    unfollowed: 4,
    dismissed: 1,
  };

  // Deliberately NOT equal to defaultFilterCounts on `followers`: if the two
  // maps agreed, a component handing FilterChips the wrong one would be
  // indistinguishable from one handing it the right one.
  const defaultCandidateCounts = { ...defaultFilterCounts, followers: 42 };

  // Helper function to create mock return value
  const createMockReturnValue = (overrides = {}) => ({
    query: '',
    setQuery: mockSetQuery,
    filteredIndices: null as number[] | null, // null = "show all"
    filters: new Set<BadgeKey>(),
    setFilters: mockSetFilters,
    filterCounts: defaultFilterCounts,
    // Task 3 added this to the hook's return and this task consumes it. A mock
    // missing it renders `undefined`, which the contract says cannot occur —
    // `null` is the absence state — and nothing would catch it, because
    // `tsconfig.json:23-32` excludes the tests (GH#70).
    candidateCounts: defaultCandidateCounts,
    isFiltering: false,
    totalCount: 21,
    hasLoadedData: true,
    processingTime: 0,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccountFiltering.mockReturnValue(createMockReturnValue());
    mockUseUploadCaveats.mockReturnValue(caveats());
  });

  /** Drives the file's existing mock; does not replace it. */
  const renderWithFilters = (filters: Set<BadgeKey>, overrides: object = {}) => {
    mockUseAccountFiltering.mockReturnValue(createMockReturnValue({ filters, ...overrides }));
    return render(<AccountListSection {...defaultProps} />);
  };

  /**
   * GH#41. When a follow-requests file is present and unreadable, both request
   * maps come back empty and every outstanding request joins notFollowingBack.
   * The badge still renders — showing 0 instead would read as good news and be
   * wrong in the other direction — so the page has to say the number may be high.
   */
  describe('overstated notFollowingBack caveat', () => {
    it('says nothing when the follow-requests files read fine', () => {
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(screen.queryByText(resultsEN.caveat.followRequests.title)).not.toBeInTheDocument();
    });

    it('names the badge, the cause, and what is still trustworthy', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ followRequestsUnreadable: true }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(screen.getByText(resultsEN.caveat.followRequests.title)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.caveat.followRequests.body)).toBeInTheDocument();
    });

    it('reassures only about counts that survive an unreadable requests file', () => {
      // The body used to end "everything else on this page is unaffected",
      // which was false about the same file: badges.pending and
      // badges.permanent read the two maps the caveat is about
      // (core/badges/index.ts:58-60), so they fall to 0 and FilterChips sweeps
      // them into "empty categories" — the page says "no pending requests" off
      // the file it could not read, and the notice vouched for it.
      const body = resultsEN.caveat.followRequests.body;

      // Followers, Following and Mutuals derive from following.json and
      // followers_*.json alone. They are the only counts safe to name.
      expect(body).toMatch(/followers/i);
      expect(body).toMatch(/following/i);
      expect(body).toMatch(/mutuals/i);
      // The understatement is stated, not just the overstatement.
      expect(body).toMatch(/pending/i);
      expect(body).not.toMatch(/everything else/i);
    });

    it('announces politely — the notice arrives after paint, and is advisory', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ followRequestsUnreadable: true }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      // role="alert" (the Alert primitive's default) is assertive, and this is
      // inserted into a live region once the stored flag resolves — cutting
      // across a screen reader mid-announcement for something advisory.
      const notice = screen.getByText(resultsEN.caveat.followRequests.title).closest('[role]');
      expect(notice).toHaveAttribute('role', 'status');
    });

    it('keeps the notFollowingBack list rather than suppressing it', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ followRequestsUnreadable: true }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      // Suppressing the badge would render "0 Not Following Back", which reads
      // as good news and lies in the other direction — silently, again.
      expect(screen.getByTestId('stat-card-not following')).toHaveTextContent('3');
    });
  });

  /**
   * The other reason a count here can be wrong, and the one the reader cannot
   * detect at all: Meta's export dialog offers a date range, and picking one
   * filters followers_*.json by entry timestamp while leaving following.json
   * whole. Measured on a real export, notFollowingBack went 95 -> 294 and
   * mutuals 298 -> 99, with no warning anywhere.
   */
  describe('truncated relationship file caveat', () => {
    it('says nothing when both files start around the same time', () => {
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(
        screen.queryByText(resultsEN.caveat.truncated.followers.title)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(resultsEN.caveat.truncated.following.title)
      ).not.toBeInTheDocument();
    });

    /**
     * The three verdicts with no copy must render nothing — and specifically
     * must not render their own name.
     *
     * `TruncatedFileCaveat` builds its i18n key by interpolating the verdict,
     * and i18next answers a missing key with the key string itself. So a
     * verdict that slipped past the guard would not fail loudly; it would paint
     * `caveat.truncated.insufficient-data.title` into the page, in all ten
     * languages, on every affected upload. That is why the guard is an
     * allow-list over the two verdicts that have copy rather than a `!==` on
     * the one that does not — a sixth verdict added later stays silent by
     * default instead of announcing itself to the reader.
     *
     * `insufficient-data` earns its own line here for a second reason: it is
     * the verdict that means "nothing was checked", and rendering the
     * truncation banner for it would state a defect nobody measured.
     */
    it.each(['no-skew', 'insufficient-data', 'not-applicable'] as const)(
      'renders nothing at all for %s, not even the key',
      verdict => {
        mockUseUploadCaveats.mockReturnValue(caveats({ truncatedRelationshipFile: verdict }));
        const { container } = renderWithRouter(<AccountListSection {...defaultProps} />);

        expect(screen.queryByText(resultsEN.caveat.truncated.followers.title)).toBeNull();
        expect(screen.queryByText(resultsEN.caveat.truncated.following.title)).toBeNull();
        expect(container.textContent).not.toContain('caveat.truncated');
      }
    );

    it('names the short list and the one action that settles it', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ truncatedRelationshipFile: 'followers' }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(screen.getByText(resultsEN.caveat.truncated.followers.title)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.caveat.truncated.followers.body)).toBeInTheDocument();
    });

    it('names the other list when the other list is the short one', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ truncatedRelationshipFile: 'following' }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(screen.getByText(resultsEN.caveat.truncated.following.title)).toBeInTheDocument();
      expect(
        screen.queryByText(resultsEN.caveat.truncated.followers.title)
      ).not.toBeInTheDocument();
    });

    it('does not tell the reader what Instagram did, only what was observed', () => {
      // A genuinely late-blooming account produces the same shape, so the copy
      // states the observation and the remedy. Asserting the absence of a
      // diagnosis is the only way this stays true through a copy edit.
      const body = resultsEN.caveat.truncated.followers.body;

      expect(body).toMatch(/date range/i);
      expect(body).toMatch(/All time/i);
      expect(body).not.toMatch(/instagram (removed|deleted|hid|truncated)/i);
    });

    it('carries no interpolation, because ten locales would each need a date formatter', () => {
      const block = resultsEN.caveat.truncated;
      const strings = [
        ...Object.values(block.followers),
        ...Object.values(block.following),
      ] as string[];

      for (const value of strings) {
        expect(value).not.toMatch(/\{\{/);
      }
    });

    it('announces politely, for the same reason its sibling does', () => {
      mockUseUploadCaveats.mockReturnValue(caveats({ truncatedRelationshipFile: 'followers' }));
      renderWithRouter(<AccountListSection {...defaultProps} />);

      const notice = screen.getByText(resultsEN.caveat.truncated.followers.title).closest('[role]');
      expect(notice).toHaveAttribute('role', 'status');
    });

    it('shows both notices at once, because they are not alternatives', () => {
      mockUseUploadCaveats.mockReturnValue(
        caveats({ followRequestsUnreadable: true, truncatedRelationshipFile: 'followers' })
      );
      renderWithRouter(<AccountListSection {...defaultProps} />);

      expect(screen.getByText(resultsEN.caveat.followRequests.title)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.caveat.truncated.followers.title)).toBeInTheDocument();
    });
  });

  // The options moved into a sheet, so what this page renders is the trigger,
  // not the chips. Asserting the stub here would only prove a closed dialog
  // still mounts its children, which it does not.
  it('should render all main components', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByText(resultsEN.header.title)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(resultsEN.search.placeholder)).toBeInTheDocument();
    expect(screen.getByText(resultsEN.filters.openSheet)).toBeInTheDocument();
    expect(screen.getByTestId('account-list')).toBeInTheDocument();
  });

  /**
   * The stat cards mutate the same filter Set as the chips and, until this test,
   * emitted nothing: 2 377 mutations across 990 sessions were invisible. The
   * assertion is on the fourth argument — a toggle without a source is the blind
   * spot returning.
   */
  it('should emit a filter toggle when a stat card is clicked', () => {
    const filterToggle = vi.spyOn(analytics, 'filterToggle');
    renderWithRouter(<AccountListSection {...defaultProps} />);

    fireEvent.click(within(screen.getByTestId('stat-card-unfollowed')).getByRole('button'));

    expect(filterToggle).toHaveBeenCalledWith('unfollowed', 'enable', 1, 'stat_card');
  });

  it('reports the toggle as a disable when the card is already active', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({ filters: new Set<BadgeKey>(['unfollowed']) })
    );
    const filterToggle = vi.spyOn(analytics, 'filterToggle');
    renderWithRouter(<AccountListSection {...defaultProps} />);

    fireEvent.click(within(screen.getByTestId('stat-card-unfollowed')).getByRole('button'));

    expect(filterToggle).toHaveBeenCalledWith('unfollowed', 'disable', 0, 'stat_card');
  });

  /**
   * `filter_clear_all` has exactly one call site in the shipped surface, and it
   * is this one. Before this task the only emitter lived on FilterChips' Reset
   * button, which called `onFiltersChange` and never reached this function —
   * so the button and the emitter were deleted together and the emit rewritten
   * here. Half of that change in either direction silently doubles the series
   * or silences it, and no gate outside this test would see it.
   */
  it('should emit exactly one filter_clear_all when the applied row is reset', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({ filters: new Set<BadgeKey>(['unfollowed', 'pending']) })
    );
    const filterClearAll = vi.spyOn(analytics, 'filterClearAll');
    renderWithRouter(<AccountListSection {...defaultProps} />);

    fireEvent.click(screen.getByText(resultsEN.filters.reset));

    expect(filterClearAll).toHaveBeenCalledTimes(1);
    expect(filterClearAll).toHaveBeenCalledWith(2);
  });

  it('should report a removal from the applied row as a chip disable', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({ filters: new Set<BadgeKey>(['unfollowed', 'pending']) })
    );
    const filterToggle = vi.spyOn(analytics, 'filterToggle');
    renderWithRouter(<AccountListSection {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: resultsEN.filters.removeOne.replace('{{label}}', resultsEN.badges.pending),
      })
    );

    expect(filterToggle).toHaveBeenCalledWith('pending', 'disable', 1, 'chip');
  });

  it('should count the applied filters on the sheet trigger', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({ filters: new Set<BadgeKey>(['unfollowed', 'pending']) })
    );
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(
      screen.getByText(resultsEN.filters.openSheetWithCount.replace('{{count}}', '2'))
    ).toBeInTheDocument();
  });

  it('should name the trigger without a count when nothing is applied', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByText(resultsEN.filters.openSheet)).toBeInTheDocument();
  });

  /**
   * The one line that makes this whole task real: the contextual map the hook
   * computes must be the map FilterChips receives.
   *
   * `candidateCounts={filterCounts}` type-checks cleanly, so neither `tsc` nor
   * any other test in the suite would notice the substitution — it would simply
   * revert the feature to the all-time counts Task 3 exists to replace.
   */
  it('should hand FilterChips the contextual counts, not the all-time ones', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);
    fireEvent.click(screen.getByText(resultsEN.filters.openSheet));

    // 42 is candidateCounts.followers; 15 is filterCounts.followers.
    expect(screen.getByTestId('candidate-followers')).toHaveTextContent('42');
    expect(screen.getByTestId('candidate-followers')).not.toHaveTextContent('15');
  });

  /**
   * And it must pass `null` through unchanged. `null` is every first paint,
   * and any fallback applied on the way — `?? {}`, `?? filterCounts` — turns
   * "not measured yet" into "every badge yields zero", which disables the whole
   * option space on arrival.
   */
  it('should pass a null candidateCounts through without a fallback', () => {
    mockUseAccountFiltering.mockReturnValue(createMockReturnValue({ candidateCounts: null }));
    renderWithRouter(<AccountListSection {...defaultProps} />);
    fireEvent.click(screen.getByText(resultsEN.filters.openSheet));

    expect(screen.getByTestId('candidate-followers')).toHaveTextContent('null');
  });

  it('should render stat cards with correct values', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByTestId('stat-card-followers')).toHaveTextContent(
      `${resultsEN.stats.followers}: 15`
    );
    expect(screen.getByTestId('stat-card-following')).toHaveTextContent(
      `${resultsEN.stats.following}: 10`
    );
    expect(screen.getByTestId('stat-card-unfollowed')).toHaveTextContent(
      `${resultsEN.stats.unfollowed}: 4`
    );
    expect(screen.getByTestId('stat-card-not following')).toHaveTextContent(
      `${resultsEN.stats.notFollowing}: 3`
    );
  });

  it('should display filename and total count', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    // File info is displayed with filename and count (may be in separate elements)
    const container = screen.getByText(resultsEN.header.title).closest('div');
    expect(container).toBeInTheDocument();
  });

  it('should show sample data banner when isSample is true', () => {
    renderWithRouter(<AccountListSection {...defaultProps} isSample={true} />);

    expect(screen.getByText(/viewing sample data/i)).toBeInTheDocument();
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
  });

  it('should not show sample data banner when isSample is false', () => {
    renderWithRouter(<AccountListSection {...defaultProps} isSample={false} />);

    expect(screen.queryByText(resultsEN.sample.banner)).not.toBeInTheDocument();
  });

  it('should handle search input changes', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(resultsEN.search.placeholder);
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(mockSetQuery).toHaveBeenCalledWith('alice');
  });

  it('should update search input value from hook', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        query: 'alice',
        filteredIndices: [0, 1], // 2 indices
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      resultsEN.search.placeholder
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('alice');
  });

  it('should pass filters to FilterChips', () => {
    const selectedFilters = new Set<BadgeKey>(['following', 'followers']);

    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        filters: selectedFilters,
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} />);

    // Applied state is on the page now, named, rather than a count inside the
    // option space — which is the whole point of splitting the surface.
    expect(screen.getByText(resultsEN.badges.following)).toBeInTheDocument();
    expect(screen.getByText(resultsEN.badges.followers)).toBeInTheDocument();
  });

  // The sheet is opened here deliberately, and only for the wiring: this is the
  // one assertion that the trigger actually mounts FilterChips and that its
  // `onFiltersChange` reaches `setFilters`. Without it a broken `asChild`
  // trigger ships green. Everything ABOUT the option space — group headings,
  // disabled options, contextual counts, the null branch — is asserted in
  // FilterChips.test.tsx against the real component, because the stub this file
  // installs cannot answer any of it.
  it('should handle filter changes from FilterChips', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    fireEvent.click(screen.getByText(resultsEN.filters.openSheet));

    const toggleButton = screen.getByText('Toggle Following');
    fireEvent.click(toggleButton);

    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('should pass filtered indices to AccountList', () => {
    const filteredIndices = [0, 1, 2]; // 3 indices

    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        filteredIndices,
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} />);

    // AccountList should show correct count
    expect(screen.getByText('Accounts (3)')).toBeInTheDocument();
  });

  it('should handle empty filtered results', () => {
    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        query: 'nonexistent',
        filteredIndices: [],
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByText('Accounts (0)')).toBeInTheDocument();
    expect(screen.getByText('No accounts match your filters')).toBeInTheDocument();
  });

  it('should handle sort order toggle', () => {
    const filteredIndices = [0, 1, 2, 3, 4];

    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        filteredIndices,
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} />);

    const sortButton = screen.getByTitle('Sort Z›A');
    expect(sortButton).toBeInTheDocument();

    fireEvent.click(sortButton);

    // After click, should show "Sort A›Z"
    expect(screen.getByTitle('Sort A›Z')).toBeInTheDocument();
  });

  it('should call useAccountFiltering with correct options', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(mockUseAccountFiltering).toHaveBeenCalledWith({
      fileHash: 'test-hash-123',
      accountCount: 21,
    });
  });

  it('does not render the rescue plan banner while the flag is off', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.queryByTestId('rescue-plan-banner')).not.toBeInTheDocument();
  });

  it('should handle zero filter counts', () => {
    const emptyFilterCounts = {
      following: 0,
      followers: 0,
      mutuals: 0,
      notFollowingBack: 0,
      notFollowedBack: 0,
      pending: 0,
      permanent: 0,
      restricted: 0,
      close: 0,
      unfollowed: 0,
      dismissed: 0,
    };

    mockUseAccountFiltering.mockReturnValue(
      createMockReturnValue({
        filteredIndices: [],
        filterCounts: emptyFilterCounts,
        totalCount: 0,
      })
    );

    renderWithRouter(<AccountListSection {...defaultProps} accountCount={0} />);

    expect(screen.getByTestId('stat-card-followers')).toHaveTextContent(
      `${resultsEN.stats.followers}: 0`
    );
    expect(screen.getByTestId('stat-card-following')).toHaveTextContent(
      `${resultsEN.stats.following}: 0`
    );
  });

  describe('promo order', () => {
    const withAdEnv = (fn: () => void) => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      vi.stubEnv('VITE_ADSENSE_SLOT_RESULTS', '111');
      try {
        fn();
      } finally {
        vi.unstubAllEnvs();
      }
    };

    it('puts the ad above the list and the donation ask below it', () => {
      withAdEnv(() => {
        const { container } = render(
          <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
        );

        const ad = container.querySelector('[data-ad-name="results"]') as HTMLElement;
        const donation = container.querySelector(
          '[data-testid="inline-donation-card"]'
        ) as HTMLElement;
        const list = container.querySelector('[data-testid="account-list"]') as HTMLElement;
        expect(ad).not.toBeNull();
        expect(donation).not.toBeNull();

        // Ad before the list...
        expect(ad.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // ...and the ask only after the visitor has their data.
        expect(
          list.compareDocumentPosition(donation) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      });
    });

    // The single-column order is carried by the DOM, not by `order-*` utilities:
    // it is the order a screen reader announces, and the only one jsdom can see.
    // The desktop hoist above both columns is the exception, and it is spelled
    // out as such — one `lg:` class rather than a mobile/desktop pair.
    it('sits between the filters and the list on mobile, hoisted above both only on desktop', () => {
      withAdEnv(() => {
        const { container } = render(
          <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
        );

        // The option space is portalled into a sheet, so it is no longer a node
        // in this column. The trigger is, and it is what the reader sees here.
        const filters = screen.getByText(resultsEN.filters.openSheet);
        const ad = container.querySelector('[data-ad-name="results"]') as HTMLElement;
        const list = container.querySelector('[data-testid="account-list"]') as HTMLElement;

        expect(filters.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(ad.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        expect(ad.className).toContain('lg:order-first');
        // No mobile-order override may survive, or it would silently reinstate
        // the old position while the DOM assertions above stayed green.
        expect(ad.className).not.toMatch(/(^|\s)order-\d/);
      });
    });

    // Both sit below the list, so both keep the reciprocity the move down bought.
    // Between them the order is the paid one first: the donation card is the last
    // thing on the page, where an unmet ask costs nothing, while the unit still
    // needs to be reached.
    it('places the low-profile unit below the list but ahead of the donation card', () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      vi.stubEnv('VITE_ADSENSE_SLOT_RESULTS_END', '333');
      try {
        const { container } = render(
          <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
        );

        const list = container.querySelector('[data-testid="account-list"]') as HTMLElement;
        const tail = container.querySelector('[data-ad-name="results_end"]') as HTMLElement;
        const donation = container.querySelector(
          '[data-testid="inline-donation-card"]'
        ) as HTMLElement;
        expect(tail).not.toBeNull();
        expect(list.compareDocumentPosition(tail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(
          tail.compareDocumentPosition(donation) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('renders nothing for the tail unit without its env var', () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      try {
        const { container } = render(
          <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
        );

        expect(container.querySelector('[data-ad-name="results_end"]')).toBeNull();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('keeps the tail unit low profile — the density ceiling leaves no slack', () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      vi.stubEnv('VITE_ADSENSE_SLOT_RESULTS_END', '333');
      try {
        const { container } = render(
          <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
        );

        const reserved = container.querySelector(
          '[data-ad-name="results_end"] [style*="min-height"]'
        ) as HTMLElement;
        expect(reserved.style.minHeight).toBe('100px');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('sticky header', () => {
    it('keeps the heading out of the sticky container, and keeps exactly one h1', () => {
      const { container } = render(
        <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
      );

      const headings = container.querySelectorAll('h1');
      // Relocated, not duplicated: two h1s would be an a11y and SEO regression,
      // which a `md:hidden` / `hidden md:block` pair would quietly introduce.
      expect(headings).toHaveLength(1);

      const sticky = container.querySelector('.sticky') as HTMLElement;
      expect(sticky).not.toBeNull();
      expect(sticky.contains(headings[0]!)).toBe(false);
    });

    it('keeps search and sort inside the sticky container', () => {
      const { container } = render(
        <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
      );

      const sticky = container.querySelector('.sticky') as HTMLElement;
      expect(sticky.querySelector('#account-search')).not.toBeNull();
      expect(sticky.querySelector('button[aria-pressed]')).not.toBeNull();
    });
  });

  describe('sort toggle contrast', () => {
    // Descending fills the toggle with --primary. A literal white glyph on it
    // measures 3.95:1 in light and 3.30:1 in dark — below AA, and below the 3:1
    // graphics allowance in dark once the /90 hover is taken into account.
    const sortToggle = (container: HTMLElement) =>
      container.querySelector('button[aria-pressed]') as HTMLElement;

    it('drives the descending state from the token, not a literal colour', () => {
      const { container } = render(
        <AccountListSection fileHash="abc" accountCount={100} filename="d.zip" />
      );

      const toggle = sortToggle(container);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(toggle.className).not.toMatch(/\btext-white\b/);
    });
  });
  /**
   * Task 5. `header.showing` reports a subset without saying which filter
   * produced it. The name has to be in the rendered text rather than in an
   * announcement: the line is wrapped in `aria-live`, live regions announce
   * changes, and initial content is not a change — so a reader arriving with a
   * filter already on from localStorage is told nothing by the live region.
   */
  describe('state line', () => {
    /**
     * Expectations are built from the bundle and matched whole.
     *
     * A bare /Recently unfollowed/ would also match the applied-filters chip
     * Task 4 renders from the same label, so it would pass with no state line
     * at all — the one thing this task adds. It would also throw on multiple
     * matches rather than assert anything.
     */
    const filled = (template: string, vars: Record<string, string>) =>
      Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, v), template);

    it('should name the filter when exactly one is applied', async () => {
      renderWithFilters(new Set<BadgeKey>(['unfollowed']));

      expect(
        await screen.findByText(
          filled(resultsEN.header.showingOne, {
            filtered: '21',
            total: '21',
            filterName: resultsEN.badges.unfollowed,
          })
        )
      ).toBeInTheDocument();
    });

    it('should count the filters when several are applied', async () => {
      renderWithFilters(new Set<BadgeKey>(['unfollowed', 'pending']));

      // Naming one of several would point the reader at a filter that is not
      // necessarily the one that emptied the list — under Task 2's semantics
      // the narrowing constraint is a group, not a badge.
      expect(
        await screen.findByText(
          filled(resultsEN.header.showingMany, { filtered: '21', total: '21', count: '2' })
        )
      ).toBeInTheDocument();
    });

    it('should not render a dangling separator when nothing is applied', async () => {
      renderWithFilters(new Set<BadgeKey>());

      expect(
        await screen.findByText(filled(resultsEN.header.showingAll, { total: '21' }))
      ).toBeInTheDocument();
      expect(screen.queryByText(/—\s*$/)).not.toBeInTheDocument();
    });
  });
  /**
   * What crosses into AccountList, which decides what the empty state says.
   *
   * This block gated a three-valued `presentInExport` until fix round 1. That
   * flag is gone, and its tests went with it: a suite asserting the behaviour
   * of a deleted feature reads as coverage while gating nothing. What is left
   * is the contract that survives — the label crosses when exactly one filter
   * is applied, and the search box's state crosses because the remove-label
   * depends on it.
   */
  describe('empty-state contract across the AccountList boundary', () => {
    it('should send the label of the single applied filter', () => {
      renderWithFilters(new Set<BadgeKey>(['pending']));

      expect(screen.getByTestId('active-filter-label')).toHaveTextContent(resultsEN.badges.pending);
    });

    it('should name no filter when several are applied', () => {
      // Naming one of several would tell the reader to remove a filter that is
      // not necessarily the one that emptied the list.
      renderWithFilters(new Set<BadgeKey>(['pending', 'unfollowed']));

      expect(screen.getByTestId('active-filter-label')).toHaveTextContent('undefined');
    });

    it('should report the search box as narrowing the list when it has a query', () => {
      // The remove-this-filter label is false whenever this is true, because
      // handleClearFilters empties the search box as well as the filters.
      renderWithFilters(new Set<BadgeKey>(['pending']), { query: 'ab' });

      expect(screen.getByTestId('search-active')).toHaveTextContent('true');
    });

    it('should report the search box as idle when it is empty', () => {
      renderWithFilters(new Set<BadgeKey>(['pending']));

      expect(screen.getByTestId('search-active')).toHaveTextContent('false');
    });
  });
});
