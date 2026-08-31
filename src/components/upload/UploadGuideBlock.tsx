import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { analytics } from '@/lib/analytics';
import { RecipeCard } from '@/components/wizard/RecipeCard';
import { StepAccordion } from '@/components/wizard/StepAccordion';
import { ACCOUNTS_CENTER_URL } from '@/config/wizard-steps';

/**
 * The guide, as a section of the upload document rather than a screen of its
 * own.
 *
 * It replaces GuideEntry, which was wizard step 1 — a full screen standing
 * between a reader and the drop zone. 647 of the 828 sessions that clicked the
 * guide's CTA and then uploaded did so within ten minutes: they already held
 * the file. A screen that teaches you how to obtain it has to let those people
 * through, and the only way it can is to stop being a screen.
 *
 * No view event of its own. guide_entry_view measured a screen being reached;
 * this block renders whether or not anybody scrolls to it, and on a 390px
 * viewport it starts below the fold. "It rendered" would be the wrong fact.
 * What replaces it is guide_open with a `source`, in PR 4.
 *
 * Ordering on the page is deliberate and was ruled on: the affiliate block
 * stays above this one (operator, 2026-08-25).
 */
interface UploadGuideBlockProps {
  /** Open the guide dialog at a section. */
  onOpenGuide?: (step: number) => void;
  /**
   * The reader has gone to ask Instagram for the file. Fired on the CTA click,
   * which opens a new tab — this page survives it, which is the whole reason
   * the waiting state can exist at all.
   */
  onAskedInstagram?: () => void;
}

export function UploadGuideBlock({ onOpenGuide, onAskedInstagram }: UploadGuideBlockProps = {}) {
  const { t } = useTranslation('wizard');

  return (
    <section className="flex flex-col gap-6 border-t border-border pt-6">
      <div>
        {/* h2, not h1: UploadZone owns the page heading. */}
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl dark:text-white">
          {t('entry.title')}
        </h2>

        {/* Two keys, never a joined line — they stack on mobile and sit inline
            from `sm:` up, so the layout never has to break a combined sentence
            for languages that run longer. */}
        <p className="mt-3 flex flex-col gap-1 text-sm text-zinc-600 sm:flex-row sm:flex-wrap sm:gap-x-1.5 dark:text-zinc-400">
          <span>{t('entry.timeCost.ours')}</span>
          <span>{t('entry.timeCost.theirs')}</span>
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:items-start">
        {/* `linkClick` is trackEvent-class on purpose: a _blank click unloads
            nothing, so there is no in-flight request for a navigation to
            cancel. It inherits the pre-hydration bypass of GH#50 — a click
            before hydration follows the href and fires no onClick — which is
            tolerable because this count is a numerator, never a funnel
            denominator. */}
        <a
          href={ACCOUNTS_CENTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            // The reader's effect first, the count second. A _blank click
            // unloads nothing, so nothing is racing the navigation here — but
            // a throw from the analytics call would otherwise cost them the
            // waiting state, which is the half of this handler they can see.
            onAskedInstagram?.();
            analytics.linkClick('meta_accounts');
          }}
          className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-3 whitespace-normal rounded-2xl bg-primary px-8 py-3 text-center text-sm font-black text-primary-foreground shadow-xl transition-all hover:scale-105 active:scale-95 sm:w-auto md:text-base"
        >
          {t('entry.cta')} <ExternalLink size={20} className="shrink-0" aria-hidden="true" />
        </a>

        {/* The two highest-CTR messages in search, kept as the CTA's own
            subtext. */}
        <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <p>{t('entry.trust.noLogin')}</p>
          <p>{t('entry.trust.local')}</p>
        </div>
      </div>

      <RecipeCard />
      <StepAccordion onSelect={onOpenGuide} />
    </section>
  );
}
