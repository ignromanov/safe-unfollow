import { Header } from '@/components/Header';
import { AppState } from '@/core/types';
import { fireEvent, renderWithRouter, screen } from '@/__tests__/test-utils';
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
    renderWithRouter(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('should render logo with ShieldCheck icon', () => {
    renderWithRouter(<Header />);

    // Logo text should be visible
    expect(screen.getByText('SafeUnfollow')).toBeInTheDocument();
    expect(screen.getByText('.app')).toBeInTheDocument();
  });

  it('should render the logo as a link to /', () => {
    renderWithRouter(<Header />);

    const logoLink = screen.getByRole('link', { name: commonEN.header.logoAria });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  // Prerendered pages are inert until React hydrates, so navigation now goes through a
  // real <a href> (PrefixedLink), not a onClick/onKeyDown handler. An anchor's Enter-key
  // behavior is native browser behavior, not something this component implements — there
  // is no component-level behavior left to assert here beyond the href check above, so
  // the old "Enter key" test is deleted rather than retargeted.

  it('should render theme toggle button', () => {
    renderWithRouter(<Header />);

    const themeButton = screen.getByTitle('Dark Mode');
    expect(themeButton).toBeInTheDocument();
  });

  it('should render language switcher', () => {
    renderWithRouter(<Header />);

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  describe('when hasData is false', () => {
    it('should render upload button', () => {
      renderWithRouter(<Header hasData={false} />);
      expect(screen.getByText(commonEN.buttons.uploadFile)).toBeInTheDocument();
    });

    it('should render the upload control as a link to /upload', () => {
      renderWithRouter(<Header hasData={false} />);

      const uploadLink = screen.getByRole('link', { name: commonEN.buttons.uploadFile });
      expect(uploadLink).toHaveAttribute('href', '/upload');
    });

    it('should highlight upload button when activeScreen is UPLOAD', () => {
      renderWithRouter(<Header hasData={false} activeScreen={AppState.UPLOAD} />);

      const uploadLink = screen.getByRole('link', { name: commonEN.buttons.uploadFile });
      // The label must come from the token, not a literal white: on --primary a
      // hardcoded white measures 3.95:1 in light and 3.30:1 in dark, both below AA.
      expect(uploadLink).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(uploadLink).not.toHaveClass('text-white');
    });
  });

  describe('when hasData is true', () => {
    it('should render view results button', () => {
      renderWithRouter(<Header hasData={true} />);

      expect(screen.getByText(commonEN.buttons.viewResults)).toBeInTheDocument();
    });

    it('should render delete button', () => {
      renderWithRouter(<Header hasData={true} />);

      expect(screen.getByText(commonEN.buttons.delete)).toBeInTheDocument();
    });

    it('should render the view results control as a link to /results', () => {
      renderWithRouter(<Header hasData={true} />);

      const viewResultsLink = screen.getByRole('link', { name: commonEN.buttons.viewResults });
      expect(viewResultsLink).toHaveAttribute('href', '/results');
    });

    it('should highlight view results button when activeScreen is RESULTS', () => {
      renderWithRouter(<Header hasData={true} activeScreen={AppState.RESULTS} />);

      const viewResultsLink = screen.getByRole('link', { name: commonEN.buttons.viewResults });
      expect(viewResultsLink).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(viewResultsLink).not.toHaveClass('text-white');
    });

    it('should open delete confirmation dialog when delete button is clicked', () => {
      renderWithRouter(<Header hasData={true} />);

      const deleteButton = screen.getByText(commonEN.buttons.delete).closest('button');
      fireEvent.click(deleteButton!);

      // Dialog should appear with title
      expect(screen.getByText(commonEN.header.clearDataTitle)).toBeInTheDocument();
      expect(screen.getByText(commonEN.header.clearDataDescription)).toBeInTheDocument();
    });

    it('should render cancel and confirm buttons in delete dialog', () => {
      renderWithRouter(<Header hasData={true} />);

      const deleteButton = screen.getByText(commonEN.buttons.delete).closest('button');
      fireEvent.click(deleteButton!);

      // Dialog should have action buttons (cancel and delete data)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('when rendered under a language prefix', () => {
    it('should carry the /ru prefix on both the logo and the upload link', () => {
      renderWithRouter(<Header hasData={false} />, { initialEntries: ['/ru'] });

      const logoLink = screen.getByRole('link', { name: commonEN.header.logoAria });
      const uploadLink = screen.getByRole('link', { name: commonEN.buttons.uploadFile });

      // No trailing slash: vercel.json sets trailingSlash:false, so "/ru/" would cost the
      // browser a 308 during the pre-hydration window. PrefixedLink special-cases `to="/"`.
      expect(logoLink).toHaveAttribute('href', '/ru');
      expect(uploadLink).toHaveAttribute('href', '/ru/upload');
    });
  });

  it('should have sticky positioning', () => {
    renderWithRouter(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0');
  });

  it('should have proper z-index for overlay behavior', () => {
    renderWithRouter(<Header />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('z-[80]');
  });
});
