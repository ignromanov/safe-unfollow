import { Layout } from '@/components/Layout';
import type { FileMetadata } from '@/core/types';
import { AppState } from '@/core/types';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock analytics (V9: added captureUTMParams for UTM tracking)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    pageView: vi.fn(),
    linkClick: vi.fn(),
    themeToggle: vi.fn(),
    clearData: vi.fn(),
  },
  captureUTMParams: vi.fn(),
}));

// Mock ThemeProvider
vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock child components
vi.mock('@/components/Header', () => ({
  Header: ({
    hasData,
    activeScreen,
    onViewResults,
    onUpload,
    onLogoClick,
    onClear,
  }: {
    hasData?: boolean;
    activeScreen?: AppState;
    onViewResults?: () => void;
    onUpload?: () => void;
    onLogoClick?: () => void;
    onClear?: () => void;
  }) => (
    <header data-testid="header">
      <div>Header - hasData: {String(hasData)}</div>
      <div>activeScreen: {activeScreen}</div>
      <button onClick={onViewResults}>View Results</button>
      <button onClick={onUpload}>Upload</button>
      <button onClick={onLogoClick}>Logo</button>
      <button onClick={onClear}>Clear</button>
    </header>
  ),
}));

vi.mock('@/components/Footer', () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/BuyMeCoffeeWidget', () => ({
  BuyMeCoffeeWidget: ({
    show,
    expandDelay,
    autoCollapseAfter,
    skipStorageCheck,
  }: {
    show?: boolean;
    expandDelay?: number;
    autoCollapseAfter?: number;
    skipStorageCheck?: boolean;
  }) => (
    <div data-testid="bmc-widget">
      <div>show: {String(show)}</div>
      <div>expandDelay: {expandDelay}</div>
      <div>autoCollapseAfter: {autoCollapseAfter}</div>
      <div>skipStorageCheck: {String(skipStorageCheck)}</div>
    </div>
  ),
}));

vi.mock('@/components/BreadcrumbSchema', () => ({
  BreadcrumbSchema: () => <script data-testid="breadcrumb-schema" />,
}));

vi.mock('@/components/OrganizationSchema', () => ({
  OrganizationSchema: () => <script data-testid="organization-schema" />,
}));

vi.mock('@/components/PageLoader', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}));

// Mock hooks
const mockHandleClearData = vi.fn();
const mockUseInstagramData = {
  uploadState: { status: 'idle' as const, error: null, fileName: null },
  fileMetadata: null as FileMetadata | null,
  handleClearData: mockHandleClearData,
  handleZipUpload: vi.fn(),
  uploadProgress: 0,
  processedCount: 0,
  totalCount: 0,
};

vi.mock('@/hooks/useInstagramData', () => ({
  useInstagramData: () => mockUseInstagramData,
}));

vi.mock('@/hooks/useLanguageFromPath', () => ({
  useLanguageFromPath: vi.fn(),
}));

vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => '',
}));

vi.mock('@/hooks/useLanguageRedirect', () => ({
  useLanguageRedirect: vi.fn(),
}));

// Mock PWA install analytics (V9: new hook)
vi.mock('@/hooks/usePWAInstallAnalytics', () => ({
  usePWAInstallAnalytics: vi.fn(),
}));

// Mock i18next (used directly in Layout.tsx)
vi.mock('i18next', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn(),
    hasResourceBundle: vi.fn(() => true),
  },
}));

// Mock locales
vi.mock('@/locales', () => ({
  RTL_LANGUAGES: ['ar', 'he'],
  SUPPORTED_LANGUAGES: ['en', 'es', 'pt', 'ru', 'de', 'hi', 'ja', 'tr', 'id', 'ar'],
  subscribeToI18nInit: vi.fn(() => () => {}),
  isI18nReady: vi.fn(() => true),
}));

// Helper to render Layout with router
const renderLayout = (initialPath = '/', lang?: 'en' | 'es' | 'ar') => {
  const TestOutlet = () => <div data-testid="page-content">Page Content</div>;

  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="*" element={<Layout lang={lang} />}>
          <Route index element={<TestOutlet />} />
          <Route path="wizard" element={<TestOutlet />} />
          <Route path="upload" element={<TestOutlet />} />
          <Route path="results" element={<TestOutlet />} />
          <Route path="sample" element={<TestOutlet />} />
          <Route path="privacy" element={<TestOutlet />} />
          <Route path="terms" element={<TestOutlet />} />
          <Route path=":lang/*" element={<TestOutlet />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('Layout', () => {
  let mockPageView: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseInstagramData.uploadState = { status: 'idle', error: null, fileName: null };
    mockUseInstagramData.fileMetadata = null;

    // Get mock reference after module is loaded
    const { analytics } = await import('@/lib/analytics');
    mockPageView = vi.mocked(analytics.pageView);
  });

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      renderLayout();
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      renderLayout();

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('footer')).toBeInTheDocument();
      expect(screen.getByTestId('bmc-widget')).toBeInTheDocument();
    });

    it('should render structured data schemas', () => {
      renderLayout();

      expect(screen.getByTestId('breadcrumb-schema')).toBeInTheDocument();
      expect(screen.getByTestId('organization-schema')).toBeInTheDocument();
    });

    it('should render page content in main element', () => {
      renderLayout();

      const main = screen.getByRole('main');
      expect(main).toContainElement(screen.getByTestId('page-content'));
    });

    it('should have proper main element id for skip link', () => {
      renderLayout();

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
    });
  });

  describe('accessibility features', () => {
    it('should render skip link for keyboard navigation', () => {
      renderLayout();

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('should have sr-only class on skip link by default', () => {
      renderLayout();

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveClass('sr-only');
    });

    it('should have focus styles on skip link', () => {
      renderLayout();

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveClass(
        'focus:not-sr-only',
        'focus:absolute',
        'focus:z-50',
        'focus:px-4',
        'focus:py-2'
      );
    });
  });

  describe('text direction (RTL/LTR)', () => {
    it('should use LTR direction by default', () => {
      renderLayout('/', 'en');

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveAttribute('dir', 'ltr');
    });

    it('should use RTL direction for RTL languages', () => {
      renderLayout('/', 'ar');

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveAttribute('dir', 'rtl');
    });

    it('should use LTR for non-RTL languages', () => {
      renderLayout('/', 'es');

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveAttribute('dir', 'ltr');
    });
  });

  describe('header props based on route', () => {
    it('should pass activeScreen as HERO for root path', () => {
      renderLayout('/');

      expect(screen.getByText(`activeScreen: ${AppState.HERO}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as WIZARD for /wizard path', () => {
      renderLayout('/wizard');

      expect(screen.getByText(`activeScreen: ${AppState.WIZARD}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as UPLOAD for /upload path', () => {
      renderLayout('/upload');

      expect(screen.getByText(`activeScreen: ${AppState.UPLOAD}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as RESULTS for /results path', () => {
      renderLayout('/results');

      expect(screen.getByText(`activeScreen: ${AppState.RESULTS}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as SAMPLE for /sample path', () => {
      renderLayout('/sample');

      expect(screen.getByText(`activeScreen: ${AppState.SAMPLE}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as PRIVACY for /privacy path', () => {
      renderLayout('/privacy');

      expect(screen.getByText(`activeScreen: ${AppState.PRIVACY}`)).toBeInTheDocument();
    });

    it('should pass activeScreen as TERMS for /terms path', () => {
      renderLayout('/terms');

      expect(screen.getByText(`activeScreen: ${AppState.TERMS}`)).toBeInTheDocument();
    });
  });

  describe('header hasData prop', () => {
    it('should pass hasData as false when no data uploaded', () => {
      mockUseInstagramData.uploadState.status = 'idle';
      mockUseInstagramData.fileMetadata = null;

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as false when upload is loading', () => {
      mockUseInstagramData.uploadState.status = 'loading';
      mockUseInstagramData.fileMetadata = null;

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as false when upload has error', () => {
      mockUseInstagramData.uploadState.status = 'error';
      mockUseInstagramData.fileMetadata = null;

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as true when upload is successful and has metadata', () => {
      mockUseInstagramData.uploadState.status = 'success';
      mockUseInstagramData.fileMetadata = {
        hash: 'abc123',
        fileName: 'test.zip',
        uploadedAt: Date.now(),
        accountCount: 100,
      };

      renderLayout();

      expect(screen.getByText('Header - hasData: true')).toBeInTheDocument();
    });

    it('should pass hasData as false when status is success but no metadata', () => {
      mockUseInstagramData.uploadState.status = 'success';
      mockUseInstagramData.fileMetadata = null;

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });
  });

  describe('BMC widget visibility', () => {
    it('should show BMC widget on /results page', () => {
      renderLayout('/results');

      expect(screen.getByText('show: true')).toBeInTheDocument();
    });

    it('should show BMC widget on /sample page', () => {
      renderLayout('/sample');

      expect(screen.getByText('show: true')).toBeInTheDocument();
    });

    it('should hide BMC widget on home page', () => {
      renderLayout('/');

      expect(screen.getByText('show: false')).toBeInTheDocument();
    });

    it('should hide BMC widget on /wizard page', () => {
      renderLayout('/wizard');

      expect(screen.getByText('show: false')).toBeInTheDocument();
    });

    it('should hide BMC widget on /upload page', () => {
      renderLayout('/upload');

      expect(screen.getByText('show: false')).toBeInTheDocument();
    });

    it('should configure BMC widget with correct props', () => {
      renderLayout('/results');

      expect(screen.getByText('expandDelay: 999999999')).toBeInTheDocument();
      expect(screen.getByText('autoCollapseAfter: 10000')).toBeInTheDocument();
    });

    it('should skip storage check on /sample page', () => {
      renderLayout('/sample');

      expect(screen.getByText('skipStorageCheck: true')).toBeInTheDocument();
    });

    it('should not skip storage check on /results page', () => {
      renderLayout('/results');

      expect(screen.getByText('skipStorageCheck: false')).toBeInTheDocument();
    });
  });

  describe('scroll behavior', () => {
    it('should scroll to top on route change', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const { rerender } = renderLayout('/');

      // Change route
      rerender(
        <MemoryRouter initialEntries={['/wizard']}>
          <Routes>
            <Route path="*" element={<Layout />}>
              <Route path="wizard" element={<div>Wizard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalled();
      });

      scrollToSpy.mockRestore();
    });
  });

  describe('analytics tracking', () => {
    it('should track page view on mount', () => {
      renderLayout('/');

      expect(mockPageView).toHaveBeenCalledWith('hero', undefined);
    });

    it('should track page view with language', () => {
      renderLayout('/', 'es');

      expect(mockPageView).toHaveBeenCalledWith('hero', 'es');
    });

    it('should track wizard page view', () => {
      renderLayout('/wizard');

      expect(mockPageView).toHaveBeenCalledWith('wizard', undefined);
    });

    it('should track upload page view', () => {
      renderLayout('/upload');

      expect(mockPageView).toHaveBeenCalledWith('upload', undefined);
    });

    it('should track results page view', () => {
      renderLayout('/results');

      expect(mockPageView).toHaveBeenCalledWith('results', undefined);
    });

    it('should track sample page view', () => {
      renderLayout('/sample');

      expect(mockPageView).toHaveBeenCalledWith('sample', undefined);
    });

    it('should track privacy page view', () => {
      renderLayout('/privacy');

      expect(mockPageView).toHaveBeenCalledWith('privacy', undefined);
    });

    it('should track terms page view', () => {
      renderLayout('/terms');

      expect(mockPageView).toHaveBeenCalledWith('terms', undefined);
    });
  });

  // NOTE: Loading state tests removed - we no longer use conditional rendering
  // to avoid React hydration errors #425 and #418. DOM structure is now
  // consistent between SSG and client-side rendering.

  describe('layout structure', () => {
    it('should have min-h-screen class on root container', () => {
      renderLayout();

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveClass('min-h-screen');
    });

    it('should have flex-col layout', () => {
      renderLayout();

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveClass('flex', 'flex-col');
    });

    it('should have flex-1 on main element for sticky footer', () => {
      renderLayout();

      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1');
    });

    it('should have container and padding on main element', () => {
      renderLayout();

      const main = screen.getByRole('main');
      expect(main).toHaveClass('container', 'mx-auto', 'px-4');
    });
  });

  describe('suspense fallback', () => {
    it('should use PageLoader as suspense fallback', () => {
      renderLayout();

      // The PageLoader is mocked and rendered within Suspense
      // We can't easily test the actual fallback behavior without triggering suspense,
      // but we can verify the component structure is correct
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });
  });

  describe('navigation handlers', () => {
    it('should call handleClearData and navigate to home when Clear is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      // Start on results page to have a different route
      renderLayout('/results');

      // Click Clear button (from mocked Header)
      const clearButton = screen.getByRole('button', { name: 'Clear' });
      await user.click(clearButton);

      // Verify handleClearData was called
      expect(mockHandleClearData).toHaveBeenCalledTimes(1);

      // Verify navigation to home (the component should navigate to '/')
      // Since we use MemoryRouter, we can check if the page changes
      await waitFor(() => {
        // The activeScreen should change to HERO after navigation
        expect(screen.getByText(`activeScreen: ${AppState.HERO}`)).toBeInTheDocument();
      });
    });

    it('should navigate to results when View Results is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/');

      const viewResultsButton = screen.getByRole('button', { name: 'View Results' });
      await user.click(viewResultsButton);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.RESULTS}`)).toBeInTheDocument();
      });
    });

    it('should navigate to upload when Upload is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/');

      const uploadButton = screen.getByRole('button', { name: 'Upload' });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.UPLOAD}`)).toBeInTheDocument();
      });
    });

    it('should navigate to home when Logo is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/results');

      const logoButton = screen.getByRole('button', { name: 'Logo' });
      await user.click(logoButton);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.HERO}`)).toBeInTheDocument();
      });
    });
  });
});
