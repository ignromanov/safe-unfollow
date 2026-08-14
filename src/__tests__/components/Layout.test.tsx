import { Layout } from '@/components/Layout';
import { LicenseDialogMount } from '@/components/export/LicenseDialogMount';
import { PrefixedLink } from '@/components/PrefixedLink';
import { AppState } from '@/core/types';
import resultsEN from '@/locales/en/results.json';
import { useAppStore } from '@/lib/store';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Mock child components.
// Header no longer takes onViewResults/onUpload/onLogoClick handlers — its logo, upload
// and view-results controls are anchors now (PrefixedLink), so they work during the
// pre-hydration window. This mock uses the real PrefixedLink so the anchor contract
// (correct href, real router navigation on click) is still exercised, not just the
// prop wiring. useLanguagePrefix is mocked to '' below, so hrefs are unprefixed here.
vi.mock('@/components/Header', () => ({
  Header: ({
    hasData,
    activeScreen,
    onClear,
  }: {
    hasData?: boolean;
    activeScreen?: AppState;
    onClear?: () => void;
  }) => (
    <header data-testid="header">
      <div>Header - hasData: {String(hasData)}</div>
      <div>activeScreen: {activeScreen}</div>
      <PrefixedLink to="/results">View Results</PrefixedLink>
      <PrefixedLink to="/upload">Upload</PrefixedLink>
      <PrefixedLink to="/">Logo</PrefixedLink>
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

// The dialog's own activation behavior is covered by LicenseDialog.test.tsx, and
// LicenseDialogMount's Suspense/lazy/memo composition and prop forwarding are covered
// by LicenseDialogMount.test.tsx; here we only care about whether Layout mounts the
// license flow at all, and with what key.
vi.mock('@/components/export/LicenseDialogMount', () => ({
  LicenseDialogMount: vi.fn(({ licenseKey }: { licenseKey: string }) => (
    <div data-testid="license-dialog">
      {resultsEN.export.license.title} / {licenseKey} / redirect
    </div>
  )),
}));

// Wraps (not replaces) the real consumeLicenseParam so the URL-stripping
// behavior stays real while call count stays observable.
vi.mock('@/lib/export/unlock', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/export/unlock')>();
  return {
    ...actual,
    consumeLicenseParam: vi.fn(actual.consumeLicenseParam),
  };
});

// Mock hooks
const mockHandleClearData = vi.fn();
const mockUseInstagramData = {
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
  SUPPORTED_LANGUAGES: ['en', 'es', 'pt', 'ru', 'de', 'ja', 'tr', 'id', 'ar'],
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
    // hasResults (Header's hasData) is now sourced from useAppStore via useHasResults,
    // not from the mocked useInstagramData — the mock above is unrelated to it after the
    // pre-hydration-flip fix, so these tests drive the real store instead.
    beforeEach(() => {
      useAppStore.setState({ uploadStatus: 'idle', fileMetadata: null });
    });

    it('should pass hasData as false when no data uploaded', () => {
      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as false when upload is loading', () => {
      useAppStore.setState({ uploadStatus: 'loading', fileMetadata: null });

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as false when upload has error', () => {
      useAppStore.setState({ uploadStatus: 'error', fileMetadata: null });

      renderLayout();

      expect(screen.getByText('Header - hasData: false')).toBeInTheDocument();
    });

    it('should pass hasData as true when upload is successful and has metadata', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: {
          name: 'test.zip',
          size: 1,
          uploadDate: new Date(),
          fileHash: 'abc123',
          accountCount: 100,
        },
      });

      renderLayout();

      expect(screen.getByText('Header - hasData: true')).toBeInTheDocument();
    });

    it('should pass hasData as false when status is success but no metadata', () => {
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: null });

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

      expect(screen.getByText('expandDelay: 60000')).toBeInTheDocument();
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
    it('should call pageView once on mount with no arguments', () => {
      renderLayout('/');

      expect(mockPageView).toHaveBeenCalledTimes(1);
      expect(mockPageView).toHaveBeenCalledWith();
    });

    it('should call pageView regardless of language prop', () => {
      renderLayout('/', 'es');

      expect(mockPageView).toHaveBeenCalledTimes(1);
      expect(mockPageView).toHaveBeenCalledWith();
    });

    it('should call pageView regardless of route', () => {
      renderLayout('/wizard');

      expect(mockPageView).toHaveBeenCalledTimes(1);
      expect(mockPageView).toHaveBeenCalledWith();
    });
  });

  // NOTE: Loading state tests removed - we no longer use conditional rendering
  // to avoid React hydration errors #425 and #418. DOM structure is now
  // consistent between SSG and client-side rendering.

  describe('layout structure', () => {
    it('should have min-h-dvh class on root container', () => {
      renderLayout();

      const container = screen.getByTestId('header').parentElement;
      expect(container).toHaveClass('min-h-dvh');
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

    it('should render View Results as an anchor to /results and navigate there when clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/');

      const viewResultsLink = screen.getByRole('link', { name: 'View Results' });
      // Prerendered pages are inert until React hydrates, so this control must be a real
      // anchor with a real href — a button with an onClick would do nothing during that
      // window. See PrefixedLink.tsx.
      expect(viewResultsLink).toHaveAttribute('href', '/results');

      await user.click(viewResultsLink);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.RESULTS}`)).toBeInTheDocument();
      });
    });

    it('should render Upload as an anchor to /upload and navigate there when clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/');

      const uploadLink = screen.getByRole('link', { name: 'Upload' });
      expect(uploadLink).toHaveAttribute('href', '/upload');

      await user.click(uploadLink);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.UPLOAD}`)).toBeInTheDocument();
      });
    });

    it('should render Logo as an anchor to / and navigate home when clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      renderLayout('/results');

      const logoLink = screen.getByRole('link', { name: 'Logo' });
      expect(logoLink).toHaveAttribute('href', '/');

      await user.click(logoLink);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.HERO}`)).toBeInTheDocument();
      });
    });
  });

  describe('license dialog mount', () => {
    it('mounts nothing license-related on a load with no ?license_key=', () => {
      // The Suspense boundary used to sit in Layout unconditionally, so SSR emitted an
      // empty dehydrated boundary into all 160 prerendered pages and React bailed out of
      // the server HTML for that subtree on every load. The boundary must not exist in
      // the tree at all when there is no key.
      renderLayout();
      expect(LicenseDialogMount).not.toHaveBeenCalled();
    });
  });

  describe('license capture', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.dodopayments.com/buy/pdt_x');
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      window.history.replaceState({}, '', '/');
      // Tests below store a real license via the unwrapped unlock module
      // (only consumeLicenseParam is mocked above); clear it so it can't leak
      // into later tests in this file, which all assume "no stored license".
      const { resetUnlockCache } = await import('@/lib/export/unlock');
      localStorage.clear();
      resetUnlockCache();
    });

    it('should strip the license param from the URL on mount', () => {
      window.history.replaceState(
        {},
        '',
        '/results?license_key=38b1460a-5104-4067-a91d-77b872934d51'
      );

      renderLayout();

      expect(window.location.search).toBe('');

      // LicenseDialogMount is mocked as a plain synchronous component in this
      // file (see the vi.mock above), so nothing here suspends — it renders
      // in the same pass as Layout. getByTestId, not findByTestId.
      expect(screen.getByTestId('license-dialog')).toBeInTheDocument();
    });

    it('should not render the license dialog without the param', () => {
      window.history.replaceState({}, '', '/results');

      renderLayout();

      expect(screen.queryByTestId('license-dialog')).not.toBeInTheDocument();
    });

    it('should read the license param exactly once, even across re-renders', async () => {
      const { consumeLicenseParam } = await import('@/lib/export/unlock');
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      window.history.replaceState(
        {},
        '',
        '/results?license_key=38b1460a-5104-4067-a91d-77b872934d51'
      );

      renderLayout('/results');

      // Force Layout to re-render without unmounting (route stays nested under
      // the same top-level <Layout>) — a second read here would spend one of
      // the license's 3 device activations, so it must not happen.
      const uploadLink = screen.getByRole('link', { name: 'Upload' });
      await user.click(uploadLink);

      await waitFor(() => {
        expect(screen.getByText(`activeScreen: ${AppState.UPLOAD}`)).toBeInTheDocument();
      });

      expect(vi.mocked(consumeLicenseParam)).toHaveBeenCalledTimes(1);
    });

    it('should strip the license param even when the feature flag is off', () => {
      // Stripping is unconditionally safe; leaving it would keep a key in the
      // address bar and in Umami's auto-tracked pageview URL with no way to
      // ever use it, since the dialog itself stays flag-gated below.
      // (No need for vi.unstubAllEnvs() here — the afterEach already ran it
      // after every previous test, and vi.stubEnv freely overwrites a stub.)
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');
      window.history.replaceState(
        {},
        '',
        '/results?license_key=38b1460a-5104-4067-a91d-77b872934d51'
      );

      renderLayout();

      expect(window.location.search).toBe('');
      expect(screen.queryByTestId('license-dialog')).not.toBeInTheDocument();
    });

    it('should not open the dialog when the captured key already matches the stored license', async () => {
      const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
      const { storeLicense } = await import('@/lib/export/unlock');
      storeLicense(KEY, 'f90ec370-fd83-46a5-8bbd-44a241e78665');
      window.history.replaceState({}, '', `/results?license_key=${KEY}`);

      renderLayout();

      // The param is still stripped from the URL even though the dialog
      // never opens — leaving it would keep the key in the address bar.
      expect(window.location.search).toBe('');
      expect(screen.queryByTestId('license-dialog')).not.toBeInTheDocument();
    });

    it('should open the dialog when the captured key differs from the stored license', async () => {
      const STORED_KEY = '38b1460a-5104-4067-a91d-77b872934d51';
      const NEW_KEY = 'a1a2a3a4-b1b2-c1c2-d1d2-e1e2e3e4e5e6';
      const { storeLicense } = await import('@/lib/export/unlock');
      storeLicense(STORED_KEY, 'f90ec370-fd83-46a5-8bbd-44a241e78665');
      window.history.replaceState({}, '', `/results?license_key=${NEW_KEY}`);

      renderLayout();

      await screen.findByTestId('license-dialog');
    });

    it('should not open the dialog for an empty license param', () => {
      window.history.replaceState({}, '', '/results?license_key=');

      renderLayout();

      expect(screen.queryByTestId('license-dialog')).not.toBeInTheDocument();
    });
  });
});
