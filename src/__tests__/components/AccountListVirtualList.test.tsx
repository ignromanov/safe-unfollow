import { AccountList } from '@/components/AccountList';
import type { AccountBadges } from '@/core/types';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 300,
    getVirtualItems: () => [
      { key: '0', index: 0, start: 0, size: 100 },
      { key: '1', index: 1, start: 100, size: 100 },
      { key: '2', index: 2, start: 200, size: 100 },
    ],
    scrollToIndex: vi.fn(),
  })),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ExternalLink: () => <span data-testid="external-link-icon">→</span>,
  User: () => <span data-testid="user-icon">👤</span>,
  Ghost: () => <span data-testid="ghost-icon">👻</span>,
}));

// Mock store
vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(selector => {
    const state = {
      fileMetadata: {
        fileHash: 'test-hash',
        accountCount: 100,
        name: 'test.zip',
        size: 1024,
        uploadDate: new Date(),
      },
    };
    return selector(state);
  }),
}));

// Mock analytics (V9: profileClick removed, only aggregation via onAccountClick)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    resultsScrollDepth: vi.fn(),
  },
}));

// Mock useAccountDataSource
const mockAccounts: AccountBadges[] = [
  { username: 'test_user_0', badges: { following: true } },
  { username: 'test_user_1', badges: { followers: true } },
  { username: 'test_user_2', badges: { mutuals: true } },
  { username: 'test_user_3', badges: {} },
  { username: 'test_user_4', badges: {} },
];

vi.mock('@/hooks/useAccountDataSource', () => ({
  useAccountDataSource: vi.fn(() => ({
    getAccount: vi.fn((index: number) => mockAccounts[index]),
  })),
}));

describe('AccountList Virtual List', () => {
  const defaultProps = {
    fileHash: 'test-hash',
    accountCount: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render virtual list with correct structure', () => {
    const accountIndices = [0, 1, 2];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    expect(screen.getByText('Accounts (3)')).toBeInTheDocument();
  });

  it('should render visible accounts', () => {
    const accountIndices = [0, 1, 2];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    expect(screen.getByText('@test_user_0')).toBeInTheDocument();
    expect(screen.getByText('@test_user_1')).toBeInTheDocument();
    expect(screen.getByText('@test_user_2')).toBeInTheDocument();
  });

  it('should handle large datasets efficiently', () => {
    const largeIndices = Array.from({ length: 10000 }, (_, i) => i);
    render(<AccountList {...defaultProps} accountIndices={largeIndices} hasLoadedData={true} />);

    // Should only render visible items (3 mocked)
    expect(screen.getByText('Accounts (10,000)')).toBeInTheDocument();
    expect(screen.getByText('@test_user_0')).toBeInTheDocument();
  });

  it('should handle empty dataset', () => {
    render(<AccountList {...defaultProps} accountIndices={[]} hasLoadedData={true} />);

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should handle single item', () => {
    const singleIndices = [0];
    render(<AccountList {...defaultProps} accountIndices={singleIndices} hasLoadedData={true} />);

    expect(screen.getByText('Accounts (1)')).toBeInTheDocument();
    expect(screen.getByText('@test_user_0')).toBeInTheDocument();
  });

  it('should not render when data not loaded', () => {
    const { container } = render(
      <AccountList {...defaultProps} accountIndices={[0, 1]} hasLoadedData={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should handle external links correctly and track analytics', () => {
    const accountIndices = [0];
    const mockOnAccountClick = vi.fn();
    render(
      <AccountList
        {...defaultProps}
        accountIndices={accountIndices}
        hasLoadedData={true}
        onAccountClick={mockOnAccountClick}
      />
    );

    // Find links to Instagram profiles
    const profileLinks = screen.getAllByRole('link');
    const firstUsernameLink = profileLinks.find(link => link.textContent?.includes('@test_user_0'));

    expect(firstUsernameLink).toBeDefined();
    expect(firstUsernameLink).toHaveAttribute('href', 'https://instagram.com/test_user_0');

    // Click link to verify aggregation callback (V9: profileClick removed)
    fireEvent.click(firstUsernameLink!);
    expect(mockOnAccountClick).toHaveBeenCalledWith(['following']); // aggregation callback
  });

  it('should display badges correctly', () => {
    const accountIndices = [0, 1, 2];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Mutuals')).toBeInTheDocument();
  });

  it('should render list header with count', () => {
    const accountIndices = [0, 1, 2, 3, 4];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    expect(screen.getByText('Accounts (5)')).toBeInTheDocument();
  });

  it('should render with external links to Instagram', () => {
    const accountIndices = [0];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    // Check that Instagram link exists
    const links = screen.getAllByRole('link');
    const instagramLinks = links.filter(link =>
      link.getAttribute('href')?.includes('instagram.com')
    );
    expect(instagramLinks.length).toBeGreaterThan(0);
  });
});
