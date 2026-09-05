import { vi, beforeEach, describe, it, expect } from 'vitest';
import { screen } from '@tests/utils/testUtils';
import { renderWithRouter } from '@/__tests__/test-utils';
import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { AccountListSection } from '@/components/AccountListSection';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
import { useProExport } from '@/hooks/useProExport';

vi.mock('@/hooks/useAccountFiltering');
vi.mock('@/hooks/useProExport');
vi.mock('@/hooks/useLanguagePrefix', () => ({ useLanguagePrefix: () => '' }));

vi.mock('@/components/FilterChips', () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}));
vi.mock('@/components/AccountList', () => ({
  AccountList: () => <div data-testid="account-list" />,
}));
vi.mock('@/components/StatCard', () => ({
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <div>
      {label}: {value}
    </div>
  ),
}));

const mockUseAccountFiltering = vi.mocked(useAccountFiltering);
const mockUseProExport = vi.mocked(useProExport);

const defaultProps = {
  fileHash: 'test-hash-123',
  accountCount: 21,
  filename: 'test.zip',
  isSample: false,
};

// Derived from the bundle, not typed out. Task 5 replaced the single
// `header.showing` with three variants; this pair asserts the announcement
// mechanics — one live region, visible, surviving the trigger's absence — not
// the wording, and with no filters applied the line is `showingAll`.
const stateLineText = resultsEN.header.showingAll.replace('{{total}}', '21');

const filterCounts = {
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

const createFilteringMock = () => ({
  query: '',
  setQuery: vi.fn(),
  filteredIndices: null,
  filters: new Set<never>(),
  setFilters: vi.fn(),
  filterCounts,
  isFiltering: false,
  totalCount: 21,
  hasLoadedData: true,
  processingTime: 0,
});

const triggerLabel = resultsEN.export.trigger;

const enableExport = () =>
  mockUseProExport.mockReturnValue({ isEnabled: true, isUnlocked: false, startCheckout: vi.fn() });

describe('AccountListSection — Pro Export gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccountFiltering.mockReturnValue(createFilteringMock());
  });

  it('should not render the export button when the feature is disabled', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: false,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.queryByRole('button', { name: triggerLabel })).not.toBeInTheDocument();
  });

  it('should render the export button when the feature is enabled', () => {
    enableExport();

    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByRole('button', { name: triggerLabel })).toBeInTheDocument();
  });

  // Sample data is 1,180 generated demo accounts — offering a paid export of it
  // would take money for a file the user has no use for.
  it('should not render the export button for sample data', () => {
    enableExport();

    renderWithRouter(<AccountListSection {...defaultProps} isSample />);

    expect(screen.queryByRole('button', { name: triggerLabel })).not.toBeInTheDocument();
  });
});

describe('AccountListSection — export trigger placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccountFiltering.mockReturnValue(createFilteringMock());
    enableExport();
  });

  // The ask used to sit above the list, before the visitor had seen what they
  // came for — the same inversion chunk B corrected when it moved the donation
  // card below the list. Position is asserted through the DOM rather than
  // `order-*` utilities so it is also the order a screen reader announces.
  it('should place the trigger after the search field and before the list', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    const search = screen.getByPlaceholderText(resultsEN.search.placeholder);
    const trigger = screen.getByRole('button', { name: triggerLabel });
    const list = screen.getByTestId('account-list');

    expect(search.compareDocumentPosition(trigger)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(trigger.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // The sticky bar is ~90px of permanently-occupied viewport under a 64px app
  // header, on a page whose traffic is 84.5% mobile. Two `p-3.5` icon buttons
  // took ~112px from the search field at 390px; only sort keeps its place.
  it('should not keep the trigger inside the sticky bar', () => {
    const { container } = renderWithRouter(<AccountListSection {...defaultProps} />);

    const sticky = container.querySelector('.sticky');
    const trigger = screen.getByRole('button', { name: triggerLabel });

    expect(sticky).not.toBeNull();
    expect(sticky?.contains(trigger)).toBe(false);
  });

  // A visible count and an sr-only live region saying the same thing read the
  // string twice to a screen reader. The visible one carries the live region.
  it('should announce the result count exactly once', () => {
    renderWithRouter(<AccountListSection {...defaultProps} />);

    const announcements = screen.getAllByText(stateLineText);

    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toHaveAttribute('aria-live', 'polite');
    expect(announcements[0]).not.toHaveClass('sr-only');
  });

  // The count is content, not a paid surface: it renders for sample data too,
  // where the trigger deliberately does not.
  it('should keep the count when the trigger is absent', () => {
    renderWithRouter(<AccountListSection {...defaultProps} isSample />);

    expect(screen.getByText(stateLineText)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: triggerLabel })).not.toBeInTheDocument();
  });
});
