import { vi, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@tests/utils/testUtils';
import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

import { DiagnosticErrorScreen } from '@/components/DiagnosticErrorScreen';
import type { DiagnosticErrorCode, ParseWarning } from '@/core/types';

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  analytics: {
    diagnosticErrorView: vi.fn(),
    diagnosticErrorRetry: vi.fn(),
    diagnosticErrorHelp: vi.fn(),
    diagnosticErrorReportIssue: vi.fn(),
    diagnosticErrorCopyDetails: vi.fn(),
  },
}));

describe('DiagnosticErrorScreen', () => {
  const mockOnTryAgain = vi.fn();
  const mockOnOpenWizard = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering with different error codes', () => {
    it('should render NOT_ZIP error', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.getByText('Not a ZIP File')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Please upload the ZIP archive from Instagram, not a folder or other file type.'
        )
      ).toBeInTheDocument();
    });

    it('should render HTML_FORMAT error', () => {
      render(<DiagnosticErrorScreen errorCode="HTML_FORMAT" />);

      expect(screen.getByText('Wrong Format: HTML')).toBeInTheDocument();
      expect(
        screen.getByText(
          'You downloaded your data in HTML format, but this tool requires JSON format to work.'
        )
      ).toBeInTheDocument();
    });

    it('should render NOT_INSTAGRAM_EXPORT error', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_INSTAGRAM_EXPORT" />);

      expect(screen.getByText('Not an Instagram Export')).toBeInTheDocument();
      expect(
        screen.getByText("This ZIP file doesn't appear to be an Instagram data export.")
      ).toBeInTheDocument();
    });

    it('should render INCOMPLETE_EXPORT error', () => {
      render(<DiagnosticErrorScreen errorCode="INCOMPLETE_EXPORT" />);

      expect(screen.getByText('Incomplete Export')).toBeInTheDocument();
      expect(
        screen.getByText('The export is missing the "Followers and following" data.')
      ).toBeInTheDocument();
    });

    it('should render NO_DATA_FILES error', () => {
      render(<DiagnosticErrorScreen errorCode="NO_DATA_FILES" />);

      expect(screen.getByText('No Follower Data Found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Could not find following.json or followers files in the expected location.'
        )
      ).toBeInTheDocument();
    });

    it('should render MISSING_FOLLOWING error', () => {
      render(<DiagnosticErrorScreen errorCode="MISSING_FOLLOWING" />);

      expect(screen.getByText('Missing Following Data')).toBeInTheDocument();
      expect(
        screen.getByText('following.json not found — cannot detect who you follow.')
      ).toBeInTheDocument();
    });

    it('should render MISSING_FOLLOWERS error', () => {
      render(<DiagnosticErrorScreen errorCode="MISSING_FOLLOWERS" />);

      expect(screen.getByText('Missing Followers Data')).toBeInTheDocument();
      expect(
        screen.getByText('followers_*.json files not found — cannot detect who follows you.')
      ).toBeInTheDocument();
    });

    it('should render UNKNOWN error', () => {
      render(<DiagnosticErrorScreen errorCode="UNKNOWN" />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(
        screen.getByText('An unexpected error occurred while processing your file.')
      ).toBeInTheDocument();
    });

    it('should render UNKNOWN error with custom message', () => {
      render(<DiagnosticErrorScreen errorCode="UNKNOWN" errorMessage="Custom error message" />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('error title and description', () => {
    it('should display error title in heading', () => {
      render(<DiagnosticErrorScreen errorCode="HTML_FORMAT" />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Wrong Format: HTML');
    });

    it('should display "How to fix this" section', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      // diagnostic.howToFix translation
      expect(screen.getByText(uploadEN.diagnostic.howToFix)).toBeInTheDocument();
      // Fix instructions for NOT_ZIP
      expect(
        screen.getByText(/Look for a file ending in .zip in your Downloads folder/)
      ).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should render "Try Again" button when onTryAgain is provided', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" onTryAgain={mockOnTryAgain} />);

      // diagnostic.tryAgain translation
      const tryAgainButton = screen.getByText(uploadEN.diagnostic.tryAgain);
      expect(tryAgainButton).toBeInTheDocument();

      fireEvent.click(tryAgainButton);
      expect(mockOnTryAgain).toHaveBeenCalledTimes(1);
    });

    it('should not render "Try Again" button when onTryAgain is not provided', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.queryByText(uploadEN.diagnostic.tryAgain)).not.toBeInTheDocument();
    });

    it('should render "Show Where I Went Wrong" button when onOpenWizard is provided', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" onOpenWizard={mockOnOpenWizard} />);

      // diagnostic.showMistakes translation
      const showMistakesButton = screen.getByText(uploadEN.diagnostic.showMistakes);
      expect(showMistakesButton).toBeInTheDocument();

      fireEvent.click(showMistakesButton);
      expect(mockOnOpenWizard).toHaveBeenCalledTimes(1);
    });

    it('should not render wizard button when onOpenWizard is not provided', () => {
      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.queryByText(uploadEN.diagnostic.showMistakes)).not.toBeInTheDocument();
    });
  });

  describe('parseWarnings integration', () => {
    it('should extract error from parseWarnings', () => {
      const parseWarnings: ParseWarning[] = [
        {
          code: 'HTML_FORMAT',
          message: 'Export is in HTML format',
          severity: 'error',
        },
      ];

      render(<DiagnosticErrorScreen parseWarnings={parseWarnings} />);

      expect(screen.getByText('Wrong Format: HTML')).toBeInTheDocument();
      // Message is now translated via i18n, so the JSON translation is shown instead of raw parser message
      expect(screen.getByText(uploadEN.diagnostic.errors.HTML_FORMAT.message)).toBeInTheDocument();
    });

    it('should prioritize errorCode over parseWarnings', () => {
      const parseWarnings: ParseWarning[] = [
        {
          code: 'HTML_FORMAT',
          message: 'Export is in HTML format',
          severity: 'error',
        },
      ];

      render(<DiagnosticErrorScreen errorCode="NOT_ZIP" parseWarnings={parseWarnings} />);

      expect(screen.getByText('Not a ZIP File')).toBeInTheDocument();
      expect(screen.queryByText('Wrong Format: HTML')).not.toBeInTheDocument();
    });

    it('should fallback to UNKNOWN when no error in parseWarnings', () => {
      const parseWarnings: ParseWarning[] = [
        {
          code: 'SOME_WARNING',
          message: 'Just a warning',
          severity: 'warning',
        },
      ];

      render(<DiagnosticErrorScreen parseWarnings={parseWarnings} />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
    });

    it('should fallback to UNKNOWN when no props provided', () => {
      render(<DiagnosticErrorScreen />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
    });
  });

  describe('all error codes render without crashing', () => {
    const errorCodes: DiagnosticErrorCode[] = [
      'NOT_ZIP',
      'HTML_FORMAT',
      'NOT_INSTAGRAM_EXPORT',
      'INCOMPLETE_EXPORT',
      'NO_DATA_FILES',
      'MISSING_FOLLOWING',
      'MISSING_FOLLOWERS',
      'UNKNOWN',
    ];

    it.each(errorCodes)('should render %s error without crashing', errorCode => {
      const { container } = render(
        <DiagnosticErrorScreen
          errorCode={errorCode}
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
          onBack={mockOnBack}
        />
      );

      expect(container).toBeInTheDocument();
      // Should have error card with proper structure
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByText(uploadEN.diagnostic.howToFix)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.diagnostic.tryAgain)).toBeInTheDocument();
    });
  });

  describe('Report Issue functionality', () => {
    const reportableErrors: DiagnosticErrorCode[] = [
      'CORRUPTED_ZIP',
      'JSON_PARSE_ERROR',
      'INVALID_DATA_STRUCTURE',
      'WORKER_TIMEOUT',
      'WORKER_INIT_ERROR',
      'WORKER_CRASHED',
      'INDEXEDDB_ERROR',
      'IDB_NOT_SUPPORTED',
      'IDB_PERMISSION_DENIED',
      'CRYPTO_NOT_AVAILABLE',
      'UNKNOWN',
    ];

    const userFixableErrors: DiagnosticErrorCode[] = [
      'NOT_ZIP',
      'HTML_FORMAT',
      'NOT_INSTAGRAM_EXPORT',
      'INCOMPLETE_EXPORT',
      'NO_DATA_FILES',
      'MISSING_FOLLOWING',
      'MISSING_FOLLOWERS',
      'ZIP_ENCRYPTED',
      'EMPTY_FILE',
      'FILE_TOO_LARGE',
      'QUOTA_EXCEEDED',
      'UPLOAD_CANCELLED',
      'NETWORK_ERROR',
    ];

    it.each(reportableErrors)('should show Report Issue link for %s', errorCode => {
      render(<DiagnosticErrorScreen errorCode={errorCode} />);

      expect(screen.getByText(uploadEN.diagnostic.reportIssue)).toBeInTheDocument();
    });

    it.each(userFixableErrors)('should NOT show Report Issue for %s', errorCode => {
      render(<DiagnosticErrorScreen errorCode={errorCode} />);

      expect(screen.queryByText(uploadEN.diagnostic.reportIssue)).not.toBeInTheDocument();
    });

    it('should generate correct GitHub issue URL', () => {
      render(<DiagnosticErrorScreen errorCode="UNKNOWN" />);

      const link = screen.getByText(uploadEN.diagnostic.reportIssue);
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
      expect(link).toHaveAttribute('href', expect.stringContaining('UNKNOWN'));
      expect(link).toHaveAttribute('href', expect.stringContaining('issues/new'));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Error code display', () => {
    it('should display error code badge', () => {
      render(<DiagnosticErrorScreen errorCode="CORRUPTED_ZIP" />);

      expect(screen.getByText('CORRUPTED_ZIP')).toBeInTheDocument();
      expect(screen.getByText(uploadEN.diagnostic.errorCode + ':')).toBeInTheDocument();
    });

    it('should display copy button', () => {
      render(<DiagnosticErrorScreen errorCode="WORKER_TIMEOUT" />);

      const copyButton = screen.getByLabelText(uploadEN.diagnostic.copyDetails);
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy error details to clipboard', async () => {
      const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<DiagnosticErrorScreen errorCode="WORKER_TIMEOUT" />);

      const copyButton = screen.getByLabelText(uploadEN.diagnostic.copyDetails);
      await fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('WORKER_TIMEOUT')
      );
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Processing Timeout')
      );
    });
  });

  describe('new error codes render correctly', () => {
    const newErrorCodes: DiagnosticErrorCode[] = [
      'CORRUPTED_ZIP',
      'ZIP_ENCRYPTED',
      'EMPTY_FILE',
      'FILE_TOO_LARGE',
      'JSON_PARSE_ERROR',
      'INVALID_DATA_STRUCTURE',
      'WORKER_TIMEOUT',
      'WORKER_INIT_ERROR',
      'WORKER_CRASHED',
      'INDEXEDDB_ERROR',
      'QUOTA_EXCEEDED',
      'IDB_NOT_SUPPORTED',
      'IDB_PERMISSION_DENIED',
      'UPLOAD_CANCELLED',
      'CRYPTO_NOT_AVAILABLE',
      'NETWORK_ERROR',
    ];

    it.each(newErrorCodes)('should render %s error with all elements', errorCode => {
      const { container } = render(
        <DiagnosticErrorScreen
          errorCode={errorCode}
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
        />
      );

      expect(container).toBeInTheDocument();
      // Should have error code displayed
      expect(screen.getByText(errorCode)).toBeInTheDocument();
      // Should have copy button
      expect(screen.getByLabelText(uploadEN.diagnostic.copyDetails)).toBeInTheDocument();
      // Should have how to fix section
      expect(screen.getByText(uploadEN.diagnostic.howToFix)).toBeInTheDocument();
    });
  });
});
