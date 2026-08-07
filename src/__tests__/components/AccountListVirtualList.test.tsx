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

  it('should handle null indices as show-all', () => {
    render(<AccountList {...defaultProps} accountIndices={null} hasLoadedData={true} />);

    // null = "show all", count comes from accountCount prop
    expect(screen.getByText('Accounts (100)')).toBeInTheDocument();
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

    // The entire row is now a single <a> link (AccountItem)
    const links = screen.getAllByRole('article');
    const firstArticle = links[0];

    expect(firstArticle).toBeDefined();
    expect(firstArticle).toHaveAttribute('href', 'https://instagram.com/test_user_0');
    expect(firstArticle.textContent).toContain('@test_user_0');

    // Click link to verify aggregation callback (V9: profileClick removed)
    fireEvent.click(firstArticle);
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

    // The entire account row is an <a> link to Instagram
    const articles = screen.getAllByRole('article');
    const instagramLinks = articles.filter(el =>
      el.getAttribute('href')?.includes('instagram.com')
    );
    expect(instagramLinks.length).toBeGreaterThan(0);
  });

  it('should have feed role on virtual list container', () => {
    const accountIndices = [0, 1, 2];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    expect(screen.getByRole('feed')).toBeInTheDocument();
  });

  it('should have article role with aria-posinset on account items', () => {
    const accountIndices = [0, 1, 2];
    render(<AccountList {...defaultProps} accountIndices={accountIndices} hasLoadedData={true} />);

    const articles = screen.getAllByRole('article');
    expect(articles[0]).toHaveAttribute('aria-posinset', '1');
    expect(articles[0]).toHaveAttribute('aria-setsize', '3');
  });

  it('caps its height rather than pinning it, so the page below the list is reachable (populated list)', () => {
    const { container } = render(
      <AccountList fileHash="abc" accountCount={5000} accountIndices={null} hasLoadedData />
    );

    const card = container.firstChild as HTMLElement;
    // A pinned height leaves only the sticky header to start a page scroll from,
    // which nobody discovers. See D9.
    expect(card.className).not.toMatch(/\bh-\[85dvh\]/);
    expect(card.className).toMatch(/max-h-\[65dvh\]/);
    expect(card.className).toMatch(/md:max-h-\[90vh\]/);
  });

  it('caps its height rather than pinning it, so the page below the list is reachable (empty state)', () => {
    // displayCount === 0 branch: a filtered-to-nothing search is the worst case for
    // a pinned height — a full-viewport card with nothing in it. See D9.
    const { container } = render(
      <AccountList fileHash="abc" accountCount={5000} accountIndices={[]} hasLoadedData />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toMatch(/\bh-\[85dvh\]/);
    expect(card.className).toMatch(/max-h-\[65dvh\]/);
    expect(card.className).toMatch(/md:max-h-\[90vh\]/);
  });

  it('keeps overscroll-contain, which guards Android pull-to-refresh at the list top', () => {
    const { container } = render(
      <AccountList fileHash="abc" accountCount={5000} accountIndices={null} hasLoadedData />
    );

    expect(container.querySelector('.overscroll-contain')).not.toBeNull();
  });
});
