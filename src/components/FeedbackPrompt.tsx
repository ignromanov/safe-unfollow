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
 * A bordered strip with no fill, deliberately one tier under
 * InlineDonationCard directly above it. It was built as a copy of that card's
 * anatomy and reversed on 2026-08-23, because matching it produced three
 * defects that all had the same cause:
 *
 * 1. The disclosure line is `text-muted-foreground` at 12px. On `bg-muted`
 *    that measures 4.32:1 — under the 4.5:1 floor — making velum-cdpo's
 *    mandatory notice the least readable text on the card. With no fill it
 *    sits on the page background at 4.72:1.
 * 2. `rounded-3xl border border-border bg-muted p-5 md:p-8` exists exactly
 *    twice in this codebase, and the copy made the two adjacent siblings.
 *    Something repeated verbatim reads as a template and the second one is
 *    skipped.
 * 3. The CTA was `w-full` on mobile while the donation card's is not, so the
 *    widest control in the tail belonged to the cheapest ask on the page —
 *    the inversion InlineDonationCard.tsx:41-47 records having to undo once
 *    already.
 *
 * The three differences from that card are all subtractive — no fill, no
 * tinted icon tile, 16px/600 against its 18px/700. Making a block quieter is
 * a cheaper way to distinguish it than making it louder, and here the
 * direction of the difference is the whole argument.
 *
 * Two structural differences from that component remain: this is a `<button>`,
 * not an `<a href>` — it has no pre-hydration destination, only a `disabled`
 * state — and there is no dismiss control.
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
    <div data-testid="feedback-prompt" className="rounded-3xl border border-border p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
        {/* One glyph, in the lead position only. The donation card carries an
            icon in both its tile and its button, but those are two different
            glyphs; the same one twice on a 390px screen reads as a mistake. */}
        <MessageSquare
          className="hidden md:block w-5 h-5 shrink-0 mt-0.5 text-muted-foreground"
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-zinc-900 dark:text-white flex items-start gap-2">
            <MessageSquare
              className="md:hidden w-5 h-5 shrink-0 mt-0.5 text-muted-foreground"
              aria-hidden="true"
            />
            {t('feedback.headline')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{t('feedback.body')}</p>
          {/* Velum's condition 3: notice before the act, not consent after it.
              Not optional, not shortenable — see the plan. The rule above it
              separates the disclosure from the pitch: this sentence is the
              only thing here a reader is entitled to have seen before the
              click, and it should not read as a third line of copy. */}
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {t('feedback.notice')}
          </p>
        </div>

        {/* Auto width in both breakpoints, and `self-start` so the mobile
            stack does not stretch it. One step under the donation CTA, which
            goes to md:px-6 md:py-3.5 md:text-base — this one stays at the
            small size everywhere. */}
        <button
          ref={triggerRef}
          type="button"
          disabled={!isClient}
          onClick={handleClick}
          className="inline-flex min-h-11 shrink-0 self-start items-center justify-center rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition-all outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/80 active:scale-95"
        >
          {t('feedback.cta')}
        </button>
      </div>
    </div>
  );
}
