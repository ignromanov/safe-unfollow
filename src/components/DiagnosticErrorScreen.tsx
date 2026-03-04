import type { DiagnosticError, DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { createDiagnosticError, mapWarningToDiagnosticCode } from '@/core/types';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileArchive,
  FileQuestion,
  FileX2,
  FolderX,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '@/lib/analytics';

export interface DiagnosticErrorScreenProps {
  /** Error code for direct error display */
  errorCode?: DiagnosticErrorCode;
  /** Custom error message (overrides default) */
  errorMessage?: string;
  /** Parse warnings from parser (will extract first error) */
  parseWarnings?: ParseWarning[];
  /** Callback when user wants to try again */
  onTryAgain?: () => void;
  /** Callback to open wizard/guide */
  onOpenWizard?: () => void;
}

/**
 * Error codes that warrant GitHub issue reporting.
 * User-fixable errors (NOT_ZIP, HTML_FORMAT) don't need issue reports.
 */
const REPORTABLE_ERROR_CODES: Set<DiagnosticErrorCode> = new Set([
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
]);

function shouldShowReportIssue(code: DiagnosticErrorCode): boolean {
  return REPORTABLE_ERROR_CODES.has(code);
}

/**
 * Generates a pre-filled GitHub issue URL for error reporting.
 */
function generateGitHubIssueUrl(error: DiagnosticError): string {
  const repo = 'ignromanov/safe-unfollow';
  const title = encodeURIComponent(`[Bug] Upload error: ${error.code}`);

  const body = encodeURIComponent(`## Error Details

- **Error Code**: \`${error.code}\`
- **Error Title**: ${error.title}
- **Error Message**: ${error.message}

## Environment

- **Browser**: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}
- **Timestamp**: ${new Date().toISOString()}

## Steps to Reproduce

1. Uploaded Instagram data export ZIP file
2. Got error: ${error.code}

## Expected Behavior

File should be processed successfully.

## Additional Context

<!-- Add any other context about the problem here -->
`);

  return `https://github.com/${repo}/issues/new?title=${title}&body=${body}&labels=bug,upload-error`;
}

/**
 * Generates error details string for clipboard.
 */
function generateErrorDetails(error: DiagnosticError): string {
  return `Error Code: ${error.code}
Title: ${error.title}
Message: ${error.message}
Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}
Timestamp: ${new Date().toISOString()}`;
}

/** Get icon component for error type */
function getErrorIcon(icon: DiagnosticError['icon']) {
  const iconProps = { size: 48, strokeWidth: 1.5 };

  switch (icon) {
    case 'html':
      return <Code2 {...iconProps} />;
    case 'zip':
      return <FileArchive {...iconProps} />;
    case 'folder':
      return <FolderX {...iconProps} />;
    case 'file':
      return <FileX2 {...iconProps} />;
    default:
      return <FileQuestion {...iconProps} />;
  }
}

/** Get color scheme for error severity */
function getColorScheme(severity: DiagnosticError['severity']) {
  if (severity === 'warning') {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-900/50',
      icon: 'text-amber-500',
      title: 'text-amber-700 dark:text-amber-400',
      text: 'text-amber-600 dark:text-amber-300',
    };
  }

  return {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-900/50',
    icon: 'text-rose-500',
    title: 'text-rose-700 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-300',
  };
}

export function DiagnosticErrorScreen({
  errorCode,
  errorMessage,
  parseWarnings,
  onTryAgain,
  onOpenWizard,
}: DiagnosticErrorScreenProps) {
  const { t } = useTranslation('upload');

  // Derive diagnostic error from props
  const diagnosticError = useMemo((): DiagnosticError => {
    // Direct error code takes priority
    if (errorCode) {
      return createDiagnosticError(errorCode, errorMessage);
    }

    // Extract from parse warnings
    if (parseWarnings?.length) {
      const firstError = parseWarnings.find(w => w.severity === 'error');
      if (firstError) {
        const code = mapWarningToDiagnosticCode(firstError.code);
        return createDiagnosticError(code, firstError.message);
      }
    }

    // Fallback to unknown error
    return createDiagnosticError('UNKNOWN', errorMessage);
  }, [errorCode, errorMessage, parseWarnings]);

  const colors = getColorScheme(diagnosticError.severity);
  const Icon = getErrorIcon(diagnosticError.icon);
  const [copied, setCopied] = useState(false);

  // Memoize GitHub URL to avoid recalculating on every render
  const gitHubIssueUrl = useMemo(() => generateGitHubIssueUrl(diagnosticError), [diagnosticError]);

  const showReportIssue = useMemo(
    () => shouldShowReportIssue(diagnosticError.code),
    [diagnosticError.code]
  );

  // Track error view on mount
  useEffect(() => {
    analytics.diagnosticErrorView(diagnosticError.code);
  }, [diagnosticError.code]);

  const handleTryAgain = useCallback(() => {
    analytics.diagnosticErrorRetry(diagnosticError.code);
    onTryAgain?.();
  }, [diagnosticError.code, onTryAgain]);

  const handleOpenWizard = useCallback(() => {
    analytics.diagnosticErrorHelp(diagnosticError.code);
    onOpenWizard?.();
  }, [diagnosticError.code, onOpenWizard]);

  const handleReportIssue = useCallback(() => {
    analytics.diagnosticErrorReportIssue(diagnosticError.code);
  }, [diagnosticError.code]);

  const handleCopyDetails = useCallback(async () => {
    try {
      const details = generateErrorDetails(diagnosticError);
      await navigator.clipboard.writeText(details);
      setCopied(true);
      analytics.diagnosticErrorCopyDetails(diagnosticError.code);
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }, [diagnosticError]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      {/* Error card */}
      <div
        className={`animate-in slide-in-from-top-4 rounded-4xl border-2 ${colors.border} ${colors.bg} p-8 md:p-12`}
      >
        {/* Icon */}
        <div className={`mb-6 ${colors.icon}`}>{Icon}</div>

        {/* Title */}
        <div className="mb-2 flex items-center gap-3">
          <AlertTriangle size={20} className={colors.icon} aria-hidden="true" />
          <h2 className={`text-sm font-black uppercase tracking-widest ${colors.title}`}>
            {t(`diagnostic.errors.${diagnosticError.code}.title`, {
              defaultValue: diagnosticError.title,
            })}
          </h2>
        </div>

        {/* Message */}
        <p className={`mb-6 text-base font-medium leading-relaxed md:text-lg ${colors.text}`}>
          {diagnosticError.code === 'UNKNOWN'
            ? diagnosticError.message
            : t(`diagnostic.errors.${diagnosticError.code}.message`, {
                defaultValue: diagnosticError.message,
              })}
        </p>

        {/* Fix section — enhanced for HTML_FORMAT */}
        <div className="mb-8 rounded-2xl bg-white/60 p-6 dark:bg-black/20">
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
            {t('diagnostic.howToFix')}
          </h3>
          <p className="text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t(`diagnostic.errors.${diagnosticError.code}.fix`, {
              defaultValue: diagnosticError.fix,
            })}
          </p>

          {/* Extra guidance for HTML format error */}
          {diagnosticError.code === 'HTML_FORMAT' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {t('diagnostic.htmlFormatExplainer')}
              </p>
              {onOpenWizard && (
                <button
                  onClick={handleOpenWizard}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-amber-700 hover:shadow-md"
                >
                  {t('diagnostic.showFormatStep')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {onTryAgain && (
            <button
              onClick={handleTryAgain}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <RefreshCw size={18} />
              {t('diagnostic.tryAgain')}
            </button>
          )}

          {onOpenWizard && (
            <button
              onClick={handleOpenWizard}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 ${colors.border} px-6 py-3 text-sm font-bold ${colors.title} transition-all hover:bg-white/50 dark:hover:bg-black/20`}
            >
              {t('diagnostic.showMistakes')}
            </button>
          )}
        </div>

        {/* Report Issue and Error Code Section */}
        <div className="mt-6 flex flex-col items-start gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
          {/* Error code badge with copy button */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {t('diagnostic.errorCode')}:
            </span>
            <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {diagnosticError.code}
            </code>
            <button
              onClick={handleCopyDetails}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title={copied ? t('diagnostic.copied') : t('diagnostic.copyDetails')}
              aria-label={t('diagnostic.copyDetails')}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Report Issue link (only for reportable errors) */}
          {showReportIssue && (
            <a
              href={gitHubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReportIssue}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ExternalLink size={14} />
              {t('diagnostic.reportIssue')}
            </a>
          )}
        </div>
      </div>

      {/* Common mistakes hint */}
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
          {t('diagnostic.commonMistakes')}
        </h4>
        <ul className="space-y-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
            <span>
              <strong>{t('diagnostic.mistakes.html.title')}</strong> —{' '}
              {t('diagnostic.mistakes.html.description')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              <strong>{t('diagnostic.mistakes.missingData.title')}</strong> —{' '}
              {t('diagnostic.mistakes.missingData.description')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            <span>
              <strong>{t('diagnostic.mistakes.wrongFile.title')}</strong> —{' '}
              {t('diagnostic.mistakes.wrongFile.description')}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
