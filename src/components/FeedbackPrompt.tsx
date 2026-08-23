import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { analytics } from '@/lib/analytics';
import { useAdViewability } from '@/hooks/useAdViewability';
import { useIsClient } from '@/hooks/useIsClient';
import { openFeedbackForm } from '@/lib/feedback/tally';

export interface FeedbackPromptProps {
  isSample?: boolean;
}

/**
 * The after-the-fact feedback ask on /results — see the comment above its
 * mount point in AccountListSection.tsx for why it sits below the donation
 * card rather than beside it.
 *
 * Matches InlineDonationCard's anatomy deliberately (`.claude/plans/2026-08-19-feedback-channel/07-trigger.md`,
 * "Chosen design"): same card, same tier of weight. Two differences from that
 * component: this is a `<button>`, not an `<a href>` — it has no pre-hydration
 * destination, only a `disabled` state — and there is no dismiss control.
 */
export function FeedbackPrompt({ isSample = false }: FeedbackPromptProps) {
  const { t, i18n } = useTranslation('results');
  const isClient = useIsClient();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Hooks run every render regardless of isSample, same as
  // ResultsExportControls's useAdViewability call: the ref stays null while
  // nothing is mounted, so the hook no-ops rather than skipping a render.
  useAdViewability(triggerRef, !isSample, () => analytics.feedbackPromptViewable());

  if (isSample) return null;

  const handleClick = (): void => {
    // Fired before the script injection this click triggers, so a click
    // whose Tally fetch fails still lands in the numerator.
    analytics.feedbackPromptClick();
    void openFeedbackForm({
      locale: i18n.language,
      page: 'results',
      version: __APP_VERSION__,
    });
  };

  return (
    <div
      data-testid="feedback-prompt"
      className="rounded-3xl border border-border bg-muted p-5 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <div className="hidden md:flex shrink-0 p-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40">
          <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="hidden md:block text-lg font-bold text-zinc-900 dark:text-white">
            {t('feedback.headline')}
          </p>
          <p className="md:hidden text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            {t('feedback.headline')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{t('feedback.body')}</p>
          {/* Velum's condition 3: notice before the act, not consent after it.
              Not optional, not shortenable — see the plan. */}
          <p className="text-xs text-muted-foreground mt-2">{t('feedback.notice')}</p>
        </div>

        <button
          ref={triggerRef}
          type="button"
          disabled={!isClient}
          onClick={handleClick}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition-all outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/80 active:scale-95 md:w-auto md:px-6 md:py-3.5 md:text-base shrink-0"
        >
          {t('feedback.cta')}
        </button>
      </div>
    </div>
  );
}
