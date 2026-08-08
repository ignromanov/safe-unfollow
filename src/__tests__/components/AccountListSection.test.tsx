import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@tests/utils/testUtils';
import { renderWithRouter } from '@/__tests__/test-utils';
import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { AccountListSection } from '@/components/AccountListSection';
import type { BadgeKey } from '@/core/types';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';

// Mock the useAccountFiltering hook
vi.mock('@/hooks/useAccountFiltering');

// Mock useLanguagePrefix
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => '',
}));

// Mock child components
vi.mock('@/components/FilterChips', () => ({
  FilterChips: ({
    selectedFilters,
    onFiltersChange,
  }: {
    selectedFilters: Set<BadgeKey>;
    onFiltersChange: (filters: Set<BadgeKey>) => void;
  }) => (
    <div data-testid="filter-chips">
      <p>Active filters: {selectedFilters.size}</p>
      <button onClick={() => onFiltersChange(new Set(['following']))}>Toggle Following</button>
    </div>
  ),
}));

vi.mock('@/components/AccountList', () => ({
  AccountList: ({
    accountIndices,
    accountCount,
  }: {
    accountIndices: number[] | null;
    accountCount: number;
  }) => {
    const count = accountIndices === null ? accountCount : accountIndices.length;
    return (
      <div data-testid="account-list">
        <p>Accounts ({count})</p>
        {accountIndices !== null && accountIndices.length === 0 && (
          <p>No accounts match your filters</p>
        )}
      </div>
    );
  },
}));

vi.mock('@/components/StatCard', () => ({
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid={`stat-card-${label.toLowerCase()}`}>
      {label}: {value}
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

  // Helper function to create mock return value
  const createMockReturnValue = (overrides = {}) => ({
    query: '',
    setQuery: mockSetQuery,
    filteredIndices: null as number[] | null, // null = "show all"
    filters: new Set<BadgeKey>(),
    setFilters: mockSetFilters,
    filterCounts: defaultFilterCounts,
    isFiltering: false,
    totalCount: 21,
    hasLoadedData: true,
    processingTime: 0,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccountFiltering.mockReturnValue(createMockReturnValue());
  });

  it('should render all main components', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByText(resultsEN.header.title)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(resultsEN.search.placeholder)).toBeInTheDocument();
    expect(screen.getByTestId('filter-chips')).toBeInTheDocument();
    expect(screen.getByTestId('account-list')).toBeInTheDocument();
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

    expect(screen.getByText('Active filters: 2')).toBeInTheDocument();
  });

  it('should handle filter changes from FilterChips', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

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

    const sortButton = screen.getByTitle('Sort Z→A');
    expect(sortButton).toBeInTheDocument();

    fireEvent.click(sortButton);

    // After click, should show "Sort A→Z"
    expect(screen.getByTitle('Sort A→Z')).toBeInTheDocument();
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

        const filters = container.querySelector('[data-testid="filter-chips"]') as HTMLElement;
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
});
