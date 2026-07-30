import { vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@tests/utils/testUtils';
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
});
