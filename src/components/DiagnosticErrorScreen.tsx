import type { DiagnosticError, DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { createDiagnosticError, mapWarningToDiagnosticCode } from '@/core/types';
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PrefixedLink } from '@/components/PrefixedLink';
import { SAME_PATH_PUSH, type GuideSourceState } from '@/hooks/useGuideDialog';
import { analytics } from '@/lib/analytics';
import {
  shouldShowReportIssue,
  generateGitHubIssueUrl,
  generateErrorDetails,
  getErrorIcon,
  getColorScheme,
  isRecoverable,
} from '@/lib/errors/diagnostic-utils';
import { guideHrefForError } from '@/lib/errors/wizard-routing';

/**
 * What the recovery CTA names when it leaves the page it is rendered on. No
 * `pushedOntoSamePath`: that navigation genuinely did not push onto the same
 * path, and claiming it did would have `close()` pop the reader back to the
 * page they came from instead of shutting the dialog.
 */
const ERROR_SOURCE_STATE: GuideSourceState = { source: 'error' };

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
  onOpenWizard?: (code?: DiagnosticErrorCode) => void;
}

/** Primary action: filled background, the control that can actually work. */
const PRIMARY_ACTION_CLASS =
  'flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg';

/** Secondary action: bordered, colour-matched to the error's scheme. */
function SECONDARY_ACTION_CLASS(colors: ReturnType<typeof getColorScheme>): string {
  return `flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 ${colors.border} px-6 py-3 text-sm font-bold ${colors.title} transition-all hover:bg-white/50 dark:hover:bg-black/20`;
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
  const recoverable = isRecoverable(diagnosticError.code);
  const Icon = getErrorIcon(diagnosticError.icon);
  const [copied, setCopied] = useState(false);

  // Memoize GitHub URL to avoid recalculating on every render
  const gitHubIssueUrl = useMemo(() => generateGitHubIssueUrl(diagnosticError), [diagnosticError]);

  const showReportIssue = useMemo(
    () => shouldShowReportIssue(diagnosticError.code),
    [diagnosticError.code]
  );

  const guideHref = guideHrefForError('', diagnosticError.code);

  // Track error view on mount
  useEffect(() => {
    analytics.diagnosticErrorView(diagnosticError.code);
  }, [diagnosticError.code]);

  const handleTryAgain = useCallback(() => {
    analytics.diagnosticErrorRetry(diagnosticError.code);
    onTryAgain?.();
  }, [diagnosticError.code, onTryAgain]);

  // Analytics only: the anchor's href does the navigating (PrefixedLink),
  // and calling onOpenWizard here as well would push the same location twice.
  const handleOpenWizard = useCallback(() => {
    analytics.diagnosticErrorHelp(diagnosticError.code);
  }, [diagnosticError.code]);

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

        {/* Actions. For a recoverable failure the wizard leads, because retrying
            the same file cannot work by construction — retry is pressed by 57.8%
            against 31.8% eventual success. It is a real link, not a button, so it
            supports cmd/middle-click and "copy link address" — and it still is,
            now that the guide's destination is a query on this same page
            rather than a route. Navigating to it opens the dialog, because the
            URL is what holds the dialog open (useGuideDialog). No handler is
            needed for that, which is why none was added. */}
        <div
          className="flex flex-col gap-3 sm:flex-row"
          role="group"
          aria-label={t('diagnostic.actionsLabel')}
        >
          {/* Two states, because two facts. The gesture is the same from both
              render sites and is named on both props; the same-path MARK is
              not, and applies only where following the link stays on this
              page. On /upload it does, and the push is invisible: two entries,
              same path, the second differing only by a query, so nothing
              downstream can see it happened and useGuideDialog needs telling
              before it pops on close. ResultsPage renders this same screen,
              where the link leaves /results and a pop would undo the
              navigation the reader asked for — so the cross-path state
              deliberately carries no mark, only the name. PrefixedLink decides
              which of the two this is, because it is the half that builds the
              href; before it was given both, the /results half of this one
              button was counted as a plain URL visit. */}
          {onOpenWizard && (
            <PrefixedLink
              to={guideHref}
              samePathState={{ ...SAME_PATH_PUSH, source: 'error' }}
              state={ERROR_SOURCE_STATE}
              onClick={handleOpenWizard}
              className={recoverable ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS(colors)}
            >
              {recoverable ? t('diagnostic.reExportJson') : t('diagnostic.showMistakes')}
            </PrefixedLink>
          )}

          {onTryAgain && (
            <button
              onClick={handleTryAgain}
              className={recoverable ? SECONDARY_ACTION_CLASS(colors) : PRIMARY_ACTION_CLASS}
            >
              {!recoverable && <RefreshCw size={18} />}
              {recoverable ? t('diagnostic.chooseDifferentFile') : t('diagnostic.tryAgain')}
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
            {/* dir="ltr" keeps the underscore-separated code intact next to an RTL
                label — same reasoning as the precedent at PaywallModal.tsx:129-131. */}
            <code
              dir="ltr"
              className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
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
