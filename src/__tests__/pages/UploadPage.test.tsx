import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component as UploadPage } from '@/pages/UploadPage';
import commonEN from '@/locales/en/common.json';

// Mock child components
vi.mock('@/components/UploadZone', () => ({
  UploadZone: ({
    onUploadStart,
    onOpenWizard,
    isProcessing,
    parseWarnings,
  }: {
    onUploadStart: (file: File) => void;
    onOpenWizard: () => void;
    isProcessing: boolean;
    parseWarnings: string[];
  }) => (
    <div data-testid="upload-zone">
      <button onClick={() => onUploadStart(new File([], 'test.zip'))}>
        {commonEN.buttons.uploadFile}
      </button>
      <button onClick={onOpenWizard}>Open Wizard</button>
      <div data-testid="is-processing">{String(isProcessing)}</div>
      <div data-testid="warnings">{parseWarnings.join(', ') || 'no-warnings'}</div>
    </div>
  ),
}));

vi.mock('@/components/PageLoader', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}));

// A guide chunk that will not load. The factory throws, so the dynamic import
// inside `lazy()` rejects — which is what a 404'd chunk does, and it is a
// different failure from a component that throws while rendering: Suspense
// handles the pending promise and then has nothing to do with the rejection.
// Only the tests that actually open the guide reach this; every other test in
// this file leaves `search` empty, so `lazy()` is never invoked.
vi.mock('@/components/guide/GuideDialog', () => {
  throw new Error('Failed to fetch dynamically imported module: GuideDialog');
});

// Mock react-router-dom
const mockNavigate = vi.fn();
// useGuideDialog reads the dialog's state off the URL, so the page needs a
// location as well as a navigate. Mutable because `search` is what decides
// whether the guide is open on arrival — the deep-link case the /docs/* pages
// and the FAQ now send readers into.
const mockLocation = { pathname: '/upload', search: '', hash: '', state: null, key: 'test' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock hooks with vi.fn() for dynamic returns
const mockUseLanguagePrefix = vi.fn(() => '');
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => mockUseLanguagePrefix(),
}));

const mockHandleZipUpload = vi.fn(() => Promise.resolve());
const mockUseInstagramData = vi.fn(() => ({
  uploadState: { status: 'idle', error: null, fileName: null },
  handleZipUpload: mockHandleZipUpload,
  parseWarnings: [],
}));
vi.mock('@/hooks/useInstagramData', () => ({
  useInstagramData: () => mockUseInstagramData(),
}));

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
    mockUseLanguagePrefix.mockReturnValue('');
    mockUseInstagramData.mockReturnValue({
      uploadState: { status: 'idle', error: null, fileName: null },
      handleZipUpload: mockHandleZipUpload,
      parseWarnings: [],
    });
  });

  describe('rendering - idle state', () => {
    it('should render without crashing', () => {
      render(<UploadPage />);

      expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
    });

    it('should render only UploadZone (no below-fold sections)', () => {
      render(<UploadPage />);

      expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
      expect(screen.queryByTestId('how-to-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('faq-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('footer-cta')).not.toBeInTheDocument();
    });

    it('should not show loader in idle state', () => {
      render(<UploadPage />);

      expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
    });

    it('should pass isProcessing as false in idle state', () => {
      render(<UploadPage />);

      expect(screen.getByTestId('is-processing')).toHaveTextContent('false');
    });
  });

  describe('rendering - loading state', () => {
    it('should pass isProcessing as true when uploading', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'loading', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      expect(screen.getByTestId('is-processing')).toHaveTextContent('true');
    });

    it('should not show loader during loading state', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'loading', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
    });
  });

  describe('rendering - error state', () => {
    it('should pass parseWarnings to UploadZone', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'idle', error: null, fileName: null },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: ['Missing followers.json', 'Corrupted data'],
      });

      render(<UploadPage />);

      expect(screen.getByTestId('warnings')).toHaveTextContent(
        'Missing followers.json, Corrupted data'
      );
    });
  });

  describe('rendering - success state with redirect', () => {
    it('should show PageLoader when upload is successful', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    });

    it('should not render UploadZone when successful', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      expect(screen.queryByTestId('upload-zone')).not.toBeInTheDocument();
    });

    it('should auto-navigate to results on success', async () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results', { replace: true });
      });
    });

    it('should use replace mode for navigation to prevent back button issues', async () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results', { replace: true });
      });
    });

    // The reader chose a filter by clicking a page about it, then handed over a ZIP. A
    // multi-second parse and a route change sit between that click and the view, and this
    // navigate is the only place the intent can survive them. `mockLocation.search` is the
    // only location the page sees and `beforeEach` already resets it (`:76`), so nothing
    // leaks into the guide deep-link tests that read the same field.
    it('should carry the filter parameter through to results', async () => {
      mockLocation.search = '?filter=pending';
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'export.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results?filter=pending', { replace: true });
      });
    });

    it('should carry the arrival source alongside the filter', async () => {
      mockLocation.search = '?filter=pending&from=pending-requests';
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'export.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results?filter=pending&from=pending-requests', {
          replace: true,
        });
      });
    });

    // The control. `${prefix}/results${location.search}` would pass both tests above and
    // ship `?guide=1` to a page with no guide on it — the query is carried by name, not
    // wholesale, and this is what says so.
    it('should carry only the two parameters results can use', async () => {
      mockLocation.search = '?guide=1&filter=pending&step=3';
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'export.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results?filter=pending', { replace: true });
      });
    });

    it('should navigate without a query string when nothing was carried', async () => {
      mockLocation.search = '?guide=1';
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'export.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results', { replace: true });
      });
    });
  });

  describe('upload handling', () => {
    it('should call handleZipUpload when file is uploaded', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      await user.click(screen.getByText(commonEN.buttons.uploadFile));

      expect(mockHandleZipUpload).toHaveBeenCalledTimes(1);
      expect(mockHandleZipUpload).toHaveBeenCalledWith(expect.any(File));
    });

    it('swallows the rejection handleZipUpload re-throws, which uploadState already reports', async () => {
      // handleZipUpload writes the failure into uploadState and then re-throws
      // by contract. This caller is fire-and-forget, so without a .catch() an
      // already-displayed parse error ALSO reaches the console as an uncaught
      // rejection — which is what every wrong-format export did in production.
      //
      // The rejecting stand-in is a plain function, NOT a vi.fn(): vitest
      // subscribes to every promise a mock returns in order to record
      // settledResults, which marks the rejection handled no matter what the
      // component does. Through a mock this assertion can never fail.
      const rejectingUpload = () =>
        Promise.reject(new Error("This doesn't appear to be an Instagram data export."));
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'idle', error: null, fileName: null },
        handleZipUpload: rejectingUpload as unknown as typeof mockHandleZipUpload,
        parseWarnings: [],
      });

      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);

      const user = userEvent.setup();
      render(<UploadPage />);
      await user.click(screen.getByText(commonEN.buttons.uploadFile));
      // Node reports an unhandled rejection only after microtasks drain.
      await new Promise(resolve => setImmediate(resolve));
      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
    });
  });

  describe('navigation - UploadZone handlers', () => {
    it('opens the guide on this page instead of navigating to a wizard route', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      await user.click(screen.getByText('Open Wizard'));

      // A push, and onto the same path: the guide is a query on /upload now.
      // `state` is the entry's own, carried across unchanged — a replace that
      // dropped it would erase the mark a same-path pusher leaves for close().
      expect(mockNavigate).toHaveBeenCalledWith('/upload?guide=1', {
        replace: false,
        state: mockLocation.state,
      });
    });
  });

  describe('a guide chunk that fails to load', () => {
    it('leaves the uploader mounted instead of taking down the route', async () => {
      // The whole point of the ErrorBoundary around the lazy guide. Without it
      // the rejection travels past Suspense (which does not catch it) to the
      // route's errorElement, and a modal that failed to download replaces
      // /upload entirely — file picker included. The product's function must
      // outlive its instructions.
      //
      // ?guide=1 rather than a click: that is how the deep link arrives, and it
      // is the path this branch made primary by repointing /docs/* and the FAQ
      // at it.
      mockLocation.search = '?guide=1';
      // React logs the caught error, and so does ErrorBoundary. Expected here,
      // and noise that would otherwise look like a real failure in the run.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(<UploadPage />);

        // Wait for the rejection to be re-thrown on the render after the lazy
        // promise settles, and be caught.
        await waitFor(() => expect(consoleError).toHaveBeenCalled());

        expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
        // Not the route error page, and not a half-rendered dialog either.
        expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
        // The uploader is still usable, not merely present.
        expect(screen.getByText(commonEN.buttons.uploadFile)).toBeInTheDocument();
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('language prefix support', () => {
    it('should use language prefix in navigation', async () => {
      mockUseLanguagePrefix.mockReturnValue('/es');

      const user = userEvent.setup();
      render(<UploadPage />);

      await user.click(screen.getByText('Open Wizard'));

      // The prefix comes from the location the dialog writes back onto, not
      // from useLanguagePrefix — the guide never leaves the page it is on.
      expect(mockNavigate).toHaveBeenCalledWith('/upload?guide=1', {
        replace: false,
        state: mockLocation.state,
      });
    });

    it('should use language prefix in auto-navigation to results', async () => {
      mockUseLanguagePrefix.mockReturnValue('/ru');
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        handleZipUpload: mockHandleZipUpload,
        parseWarnings: [],
      });

      render(<UploadPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/ru/results', { replace: true });
      });
    });
  });
});
