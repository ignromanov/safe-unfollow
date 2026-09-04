import { vi, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, renderWithRouter, screen, within } from '@/__tests__/test-utils';
import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

import { useLocation } from 'react-router-dom';

import { DiagnosticErrorScreen } from '@/components/DiagnosticErrorScreen';
import { NON_ENGLISH_LANGUAGES } from '@/config/languages';
import type { DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { SAME_PATH_PUSH } from '@/hooks/useGuideDialog';
import { analytics } from '@/lib/analytics';
import { guideHrefForError } from '@/lib/errors/wizard-routing';

/** Reports the state of the entry the router is standing on. */
function EntryStateProbe() {
  const { state } = useLocation();
  return <span data-testid="entry-state">{JSON.stringify(state) ?? ''}</span>;
}

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
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.getByText('Not a ZIP File')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Please upload the ZIP archive from Instagram, not a folder or other file type.'
        )
      ).toBeInTheDocument();
    });

    it('should render HTML_FORMAT error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="HTML_FORMAT" />);

      expect(screen.getByText(uploadEN.diagnostic.errors.HTML_FORMAT.title)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.diagnostic.errors.HTML_FORMAT.message)).toBeInTheDocument();
    });

    it('should render NOT_INSTAGRAM_EXPORT error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_INSTAGRAM_EXPORT" />);

      expect(screen.getByText('Not an Instagram Export')).toBeInTheDocument();
      expect(
        screen.getByText("This ZIP file doesn't appear to be an Instagram data export.")
      ).toBeInTheDocument();
    });

    it('should render INCOMPLETE_EXPORT error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="INCOMPLETE_EXPORT" />);

      expect(screen.getByText('Incomplete Export')).toBeInTheDocument();
      expect(
        screen.getByText('The export is missing the "Followers and following" data.')
      ).toBeInTheDocument();
    });

    it('should render NO_DATA_FILES error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="NO_DATA_FILES" />);

      expect(screen.getByText('No Follower Data Found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Could not find following.json or followers files in the expected location.'
        )
      ).toBeInTheDocument();
    });

    it('should render MISSING_FOLLOWING error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="MISSING_FOLLOWING" />);

      expect(screen.getByText('Missing Following Data')).toBeInTheDocument();
      expect(
        screen.getByText('following.json not found — cannot detect who you follow.')
      ).toBeInTheDocument();
    });

    it('should render MISSING_FOLLOWERS error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="MISSING_FOLLOWERS" />);

      expect(screen.getByText('Missing Followers Data')).toBeInTheDocument();
      expect(
        screen.getByText('followers_*.json files not found — cannot detect who follows you.')
      ).toBeInTheDocument();
    });

    it('should render UNKNOWN error', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="UNKNOWN" />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(
        screen.getByText('An unexpected error occurred while processing your file.')
      ).toBeInTheDocument();
    });

    it('should render UNKNOWN error with custom message', () => {
      renderWithRouter(
        <DiagnosticErrorScreen errorCode="UNKNOWN" errorMessage="Custom error message" />
      );

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('error title and description', () => {
    it('should display error title in heading', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="HTML_FORMAT" />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(uploadEN.diagnostic.errors.HTML_FORMAT.title);
    });

    it('should display "How to fix this" section', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

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
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" onTryAgain={mockOnTryAgain} />);

      // diagnostic.tryAgain translation
      const tryAgainButton = screen.getByText(uploadEN.diagnostic.tryAgain);
      expect(tryAgainButton).toBeInTheDocument();

      fireEvent.click(tryAgainButton);
      expect(mockOnTryAgain).toHaveBeenCalledTimes(1);
    });

    it('should not render "Try Again" button when onTryAgain is not provided', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.queryByText(uploadEN.diagnostic.tryAgain)).not.toBeInTheDocument();
    });

    it('should render "Show Where I Went Wrong" link when onOpenWizard is provided', () => {
      // NOT_ZIP is not recoverable, so the wizard control keeps its original
      // label and is the secondary action. It is a real link now — navigation
      // comes from its href (PrefixedLink), not from calling onOpenWizard.
      renderWithRouter(
        <DiagnosticErrorScreen errorCode="NOT_ZIP" onOpenWizard={mockOnOpenWizard} />
      );

      // diagnostic.showMistakes translation
      const showMistakesLink = screen.getByRole('link', { name: uploadEN.diagnostic.showMistakes });
      expect(showMistakesLink).toHaveAttribute('href', expect.stringContaining('/upload?step=4'));

      fireEvent.click(showMistakesLink);
      expect(analytics.diagnosticErrorHelp).toHaveBeenCalledWith('NOT_ZIP');
    });

    it('should not render wizard link when onOpenWizard is not provided', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" />);

      expect(screen.queryByText(uploadEN.diagnostic.showMistakes)).not.toBeInTheDocument();
    });
  });

  describe('action hierarchy', () => {
    it('leads a recoverable failure with the wizard, as a real link', () => {
      renderWithRouter(
        <DiagnosticErrorScreen
          errorCode="HTML_FORMAT"
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
        />
      );

      const actions = screen.getByRole('group', { name: /actions/i });
      const primary = within(actions).getByRole('link');

      expect(primary).toHaveAccessibleName(/re-export as json/i);
      expect(primary).toHaveAttribute('href', expect.stringContaining('/upload?step=6'));
    });

    it('offers a different file as the secondary, never as a retry', () => {
      renderWithRouter(
        <DiagnosticErrorScreen
          errorCode="HTML_FORMAT"
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
        />
      );

      expect(screen.getByRole('button', { name: /choose a different file/i })).toBeInTheDocument();
      expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
    });

    it('keeps retry as the primary where the failure is genuinely transient', () => {
      renderWithRouter(
        <DiagnosticErrorScreen
          errorCode="WORKER_CRASHED"
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
        />
      );

      // The wizard control is the secondary here — a real link, not a button —
      // and retry keeps the primary, filled style.
      const actions = screen.getByRole('group', { name: /actions/i });
      const secondary = within(actions).getByRole('link', {
        name: uploadEN.diagnostic.showMistakes,
      });

      expect(secondary).toHaveAttribute('href', expect.stringContaining('/upload?step=6'));
      expect(within(actions).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('locale-prefixed navigation', () => {
    it('carries the locale prefix into the primary action link', () => {
      // Every href assertion above renders at initialEntries: ['/'] (the
      // renderWithRouter default), so none of them exercise the prefix a
      // real locale route adds.
      renderWithRouter(
        <DiagnosticErrorScreen
          errorCode="HTML_FORMAT"
          onTryAgain={mockOnTryAgain}
          onOpenWizard={mockOnOpenWizard}
        />,
        { initialEntries: ['/ar/upload'] }
      );

      const actions = screen.getByRole('group', { name: /actions/i });
      const primary = within(actions).getByRole('link');

      expect(primary).toHaveAttribute('href', '/ar/upload?step=6');
    });
  });

  describe('the history entry the guide link pushes', () => {
    // useGuideDialog pops that entry when the reader closes the guide, and it
    // can only know to do so if the pusher says the push stayed on this page.
    // No handler of ours runs on the way — the anchor navigates by itself.
    const code: DiagnosticErrorCode = 'HTML_FORMAT';
    const href = guideHrefForError('', code);
    const entryState = () => screen.getByTestId('entry-state').textContent;

    it('marks it as a same-path push when the guide opens on this very page', () => {
      renderWithRouter(
        <>
          <DiagnosticErrorScreen errorCode={code} onOpenWizard={mockOnOpenWizard} />
          <EntryStateProbe />
        </>,
        { initialEntries: [href.split('?')[0]] }
      );

      fireEvent.click(screen.getByRole('link', { name: uploadEN.diagnostic.reExportJson }));

      expect(entryState()).toBe(JSON.stringify({ ...SAME_PATH_PUSH, source: 'error' }));
    });

    it('leaves it unmarked when the same screen renders on another route', () => {
      // ResultsPage renders this screen too, and there the link is a real
      // navigation away. Popping it on close would undo the move the reader
      // asked for and drop them back on the failed results page.
      renderWithRouter(
        <>
          <DiagnosticErrorScreen errorCode={code} onOpenWizard={mockOnOpenWizard} />
          <EntryStateProbe />
        </>,
        { initialEntries: ['/results'] }
      );

      fireEvent.click(screen.getByRole('link', { name: uploadEN.diagnostic.reExportJson }));

      expect(entryState()).not.toContain('pushedOntoSamePath');
    });

    // The two cases above both stand at the English root, where the prefix is
    // '' — so a same-path comparison that lost the prefix would pass them
    // anyway, and did, while every prefixed locale silently went unmarked. The
    // list is derived, not written out: a locale added tomorrow is bound the
    // day it appears.
    it.each(NON_ENGLISH_LANGUAGES)('marks it the same under the /%s prefix', lang => {
      renderWithRouter(
        <>
          <DiagnosticErrorScreen errorCode={code} onOpenWizard={mockOnOpenWizard} />
          <EntryStateProbe />
        </>,
        { initialEntries: [`/${lang}${href.split('?')[0]}`] }
      );

      fireEvent.click(screen.getByRole('link', { name: uploadEN.diagnostic.reExportJson }));

      expect(entryState()).toBe(JSON.stringify({ ...SAME_PATH_PUSH, source: 'error' }));
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

      renderWithRouter(<DiagnosticErrorScreen parseWarnings={parseWarnings} />);

      expect(screen.getByText(uploadEN.diagnostic.errors.HTML_FORMAT.title)).toBeInTheDocument();
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

      renderWithRouter(<DiagnosticErrorScreen errorCode="NOT_ZIP" parseWarnings={parseWarnings} />);

      expect(screen.getByText('Not a ZIP File')).toBeInTheDocument();
      expect(
        screen.queryByText(uploadEN.diagnostic.errors.HTML_FORMAT.title)
      ).not.toBeInTheDocument();
    });

    it('should fallback to UNKNOWN when no error in parseWarnings', () => {
      const parseWarnings: ParseWarning[] = [
        {
          code: 'SOME_WARNING',
          message: 'Just a warning',
          severity: 'warning',
        },
      ];

      renderWithRouter(<DiagnosticErrorScreen parseWarnings={parseWarnings} />);

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
    });

    it('should fallback to UNKNOWN when no props provided', () => {
      renderWithRouter(<DiagnosticErrorScreen />);

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
      const { container } = renderWithRouter(
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
      // HTML_FORMAT is recoverable: the primary action is "choose a different
      // file", not "try again" — see the "action hierarchy" describe block.
      const primaryLabel =
        errorCode === 'HTML_FORMAT'
          ? uploadEN.diagnostic.chooseDifferentFile
          : uploadEN.diagnostic.tryAgain;
      expect(screen.getByText(primaryLabel)).toBeInTheDocument();
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
      renderWithRouter(<DiagnosticErrorScreen errorCode={errorCode} />);

      expect(screen.getByText(uploadEN.diagnostic.reportIssue)).toBeInTheDocument();
    });

    it.each(userFixableErrors)('should NOT show Report Issue for %s', errorCode => {
      renderWithRouter(<DiagnosticErrorScreen errorCode={errorCode} />);

      expect(screen.queryByText(uploadEN.diagnostic.reportIssue)).not.toBeInTheDocument();
    });

    it('should generate correct GitHub issue URL', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="UNKNOWN" />);

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
      renderWithRouter(<DiagnosticErrorScreen errorCode="CORRUPTED_ZIP" />);

      expect(screen.getByText('CORRUPTED_ZIP')).toBeInTheDocument();
      expect(screen.getByText(uploadEN.diagnostic.errorCode + ':')).toBeInTheDocument();
    });

    it('keeps the error code left-to-right, since it sits beside RTL text in other locales', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="HTML_FORMAT" />);

      expect(screen.getByText('HTML_FORMAT')).toHaveAttribute('dir', 'ltr');
    });

    it('should display copy button', () => {
      renderWithRouter(<DiagnosticErrorScreen errorCode="WORKER_TIMEOUT" />);

      const copyButton = screen.getByLabelText(uploadEN.diagnostic.copyDetails);
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy error details to clipboard', async () => {
      const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
      Object.assign(navigator, { clipboard: mockClipboard });

      renderWithRouter(<DiagnosticErrorScreen errorCode="WORKER_TIMEOUT" />);

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
      const { container } = renderWithRouter(
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
