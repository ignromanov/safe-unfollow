import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { analytics } from '@/lib/analytics';
import { PrefixedLink } from '@/components/PrefixedLink';
import { RecipeCard } from '@/components/wizard/RecipeCard';
import { StepAccordion } from '@/components/wizard/StepAccordion';
import { ACCOUNTS_CENTER_URL } from '@/config/wizard-steps';

/**
 * Replaces wizard step 1. 63.4% of readers left at the old step-1 card, which
 * competed a title, a description, an external-link button and a shortcut
 * link for attention. This screen has one action: open Instagram's Accounts
 * Center. Everything below it — the recipe card, the "already have my file"
 * shortcut, the step accordion — is reference material, not a second set of
 * instructions to complete before clicking.
 *
 * "Try with sample" is deliberately absent — it lives in the bottom bar's
 * secondary slot (a separate task), not on this screen.
 */
export function GuideEntry({ ctaRef }: { ctaRef?: (node: HTMLAnchorElement | null) => void }) {
  const { t } = useTranslation('wizard');

  // Owns its own view event so step 1 emits guide_entry_view, not
  // wizard_step_view — see Wizard.tsx, which skips step 1 in its own effect.
  useEffect(() => {
    analytics.guideEntryView();
  }, []);

  return (
    <div className="max-w-xl w-full rounded-4xl overflow-hidden shadow-2xl border border-border bg-card">
      <div className="p-6 md:p-8 space-y-6">
        <h2 className="text-2xl md:text-3xl font-display font-bold leading-tight text-zinc-900 dark:text-white">
          {t('entry.title')}
        </h2>

        {/* Two keys, never a joined line — they stack on mobile and sit
            inline from `sm:` up, so the layout never has to break a
            combined sentence for languages that run longer. */}
        <p className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{t('entry.timeCost.ours')}</span>
          <span>{t('entry.timeCost.theirs')}</span>
        </p>

        <div className="flex flex-col items-stretch sm:items-start gap-3">
          {/* The screen's one action, so it is also the only thing that
              distinguishes "clicked the CTA" from "scrolled past it and hit
              Next". `linkClick` is trackEvent-class on purpose: a _blank
              click unloads nothing, so there is no in-flight request for a
              navigation to cancel. It inherits the pre-hydration bypass of
              GH#50 — a click before hydration follows the href and fires no
              onClick — which is tolerable here because this count is a
              numerator, never a funnel denominator. */}
          <a
            ref={ctaRef}
            href={ACCOUNTS_CENTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.linkClick('meta_accounts')}
            className="cursor-pointer inline-flex min-h-[48px] items-center justify-center gap-3 whitespace-normal px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base text-center w-full sm:w-auto"
          >
            {t('entry.cta')} <ExternalLink size={20} className="shrink-0" aria-hidden="true" />
          </a>

          {/* The two highest-CTR messages in search, kept as the CTA's own
              subtext — the highest-attention position on the screen. */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p>{t('entry.trust.noLogin')}</p>
            <p>{t('entry.trust.local')}</p>
          </div>
        </div>

        <RecipeCard />

        <PrefixedLink
          to="/upload"
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary dark:hover:text-primary transition-colors"
        >
          {t('buttons.alreadyHaveFile')}
        </PrefixedLink>

        <StepAccordion />
      </div>
    </div>
  );
}
