import { Header } from '@/components/Header';
import { AppState } from '@/core/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import commonEN from '@/locales/en/common.json';

// react-i18next is already mocked globally in vitest.setup.ts

// Mock next-themes with controllable state
const mockSetTheme = vi.fn();
const mockTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    get theme() {
      return mockTheme;
    },
    setTheme: mockSetTheme,
  }),
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  analytics: {
    themeToggle: vi.fn(),
    clearData: vi.fn(),
  },
}));

// Mock LanguageSwitcher component
vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

describe('HeaderV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('should render logo with ShieldCheck icon', () => {
    render(<Header />);

    // Logo text should be visible
    expect(screen.getByText('SafeUnfollow')).toBeInTheDocument();
    expect(screen.getByText('.app')).toBeInTheDocument();
  });

  it('should render logo as clickable button', () => {
    render(<Header />);

    const logoButton = screen.getByRole('button', { name: /SafeUnfollow/i });
    expect(logoButton).toBeInTheDocument();
    expect(logoButton).toHaveAttribute('tabIndex', '0');
  });

  it('should call onLogoClick when logo is clicked', () => {
    const onLogoClick = vi.fn();
    render(<Header onLogoClick={onLogoClick} />);

    const logoContainer = screen.getByText('SafeUnfollow').closest('[role="button"]');
    fireEvent.click(logoContainer!);

    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it('should call onLogoClick when Enter key is pressed on logo', () => {
    const onLogoClick = vi.fn();
    render(<Header onLogoClick={onLogoClick} />);

    const logoContainer = screen.getByText('SafeUnfollow').closest('[role="button"]');
    fireEvent.keyDown(logoContainer!, { key: 'Enter' });

    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it('should render theme toggle button', () => {
    render(<Header />);

    const themeButton = screen.getByTitle('Dark Mode');
    expect(themeButton).toBeInTheDocument();
  });

  it('should render language switcher', () => {
    render(<Header />);

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  describe('when hasData is false', () => {
    it('should render upload button', () => {
      render(<Header hasData={false} />);
      expect(screen.getByText(commonEN.buttons.uploadFile)).toBeInTheDocument();
    });

    it('should call onUpload when upload button is clicked', () => {
      const onUpload = vi.fn();
      render(<Header hasData={false} onUpload={onUpload} />);

      const uploadButton = screen.getByText(commonEN.buttons.uploadFile).closest('button');
      fireEvent.click(uploadButton!);

      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    it('should highlight upload button when activeScreen is UPLOAD', () => {
      render(<Header hasData={false} activeScreen={AppState.UPLOAD} />);

      const uploadButton = screen.getByText(commonEN.buttons.uploadFile).closest('button');
      // The label must come from the token, not a literal white: on --primary a
      // hardcoded white measures 3.95:1 in light and 3.30:1 in dark, both below AA.
      expect(uploadButton).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(uploadButton).not.toHaveClass('text-white');
    });
  });

  describe('when hasData is true', () => {
    it('should render view results button', () => {
      render(<Header hasData={true} />);

      expect(screen.getByText(commonEN.buttons.viewResults)).toBeInTheDocument();
    });

    it('should render delete button', () => {
      render(<Header hasData={true} />);

      expect(screen.getByText(commonEN.buttons.delete)).toBeInTheDocument();
    });

    it('should call onViewResults when view results button is clicked', () => {
      const onViewResults = vi.fn();
      render(<Header hasData={true} onViewResults={onViewResults} />);

      const viewResultsButton = screen.getByText(commonEN.buttons.viewResults).closest('button');
      fireEvent.click(viewResultsButton!);

      expect(onViewResults).toHaveBeenCalledTimes(1);
    });

    it('should highlight view results button when activeScreen is RESULTS', () => {
      render(<Header hasData={true} activeScreen={AppState.RESULTS} />);

      const viewResultsButton = screen.getByText(commonEN.buttons.viewResults).closest('button');
      expect(viewResultsButton).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(viewResultsButton).not.toHaveClass('text-white');
    });

    it('should open delete confirmation dialog when delete button is clicked', () => {
      render(<Header hasData={true} />);

      const deleteButton = screen.getByText(commonEN.buttons.delete).closest('button');
      fireEvent.click(deleteButton!);

      // Dialog should appear with title
      expect(screen.getByText(commonEN.header.clearDataTitle)).toBeInTheDocument();
      expect(screen.getByText(commonEN.header.clearDataDescription)).toBeInTheDocument();
    });

    it('should render cancel and confirm buttons in delete dialog', () => {
      render(<Header hasData={true} />);

      const deleteButton = screen.getByText(commonEN.buttons.delete).closest('button');
      fireEvent.click(deleteButton!);

      // Dialog should have action buttons (cancel and delete data)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should have sticky positioning', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0');
  });

  it('should have proper z-index for overlay behavior', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('z-[80]');
  });
});
