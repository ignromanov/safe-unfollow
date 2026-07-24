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

    expect(screen.queryByLabelText(resultsEN.export.downloadAriaLabel)).not.toBeInTheDocument();
  });

  it('should render the export button when the feature is enabled', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    renderWithRouter(<AccountListSection {...defaultProps} />);

    expect(screen.getByLabelText(resultsEN.export.downloadAriaLabel)).toBeInTheDocument();
  });

  // Sample data is 1,180 generated demo accounts — offering a paid export of it
  // would take money for a file the user has no use for.
  it('should not render the export button for sample data', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    renderWithRouter(<AccountListSection {...defaultProps} isSample />);

    expect(screen.queryByLabelText(resultsEN.export.downloadAriaLabel)).not.toBeInTheDocument();
  });
});
