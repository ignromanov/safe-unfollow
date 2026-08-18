import type { DiagnosticError, DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { createDiagnosticError, mapWarningToDiagnosticCode } from '@/core/types';
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '@/lib/analytics';
import {
  shouldShowReportIssue,
  generateGitHubIssueUrl,
  generateErrorDetails,
  getErrorIcon,
  getColorScheme,
} from '@/lib/errors/diagnostic-utils';

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

  const colors = getColorScheme(diagnosticError);
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
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {onTryAgain && (
            <button
              onClick={handleTryAgain}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg"
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
    </div>
  );
}
