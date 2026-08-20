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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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
    it('should navigate to wizard when Open Wizard is clicked', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      await user.click(screen.getByText('Open Wizard'));

      expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/6');
    });
  });

  describe('language prefix support', () => {
    it('should use language prefix in navigation', async () => {
      mockUseLanguagePrefix.mockReturnValue('/es');

      const user = userEvent.setup();
      render(<UploadPage />);

      await user.click(screen.getByText('Open Wizard'));

      expect(mockNavigate).toHaveBeenCalledWith('/es/wizard/step/6');
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
