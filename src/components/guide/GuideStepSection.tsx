import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ResponsiveGif } from '@/components/ResponsiveGif';
import { guideStepAnchorId, guideStepPosterSize, type GuideStep } from '@/config/wizard-steps';
import { analytics } from '@/lib/analytics';

interface GuideStepSectionProps {
  step: GuideStep;
  /** True when the section is inside (or near) the viewport. */
  isInView: boolean;
}

/**
 * One instruction, as a section of the guide's single scroll.
 *
 * Carries the anchor `?step=N` scrolls to, so the id is the section's
 * contract with the URL and not a styling hook.
 */
export function GuideStepSection({ step, isInView }: GuideStepSectionProps) {
  const { t } = useTranslation('wizard');
  const title = t(`steps.${step.id}.title` as any);
  const anchorId = guideStepAnchorId(step.id);
  const posterSize = guideStepPosterSize(step.id);

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-heading`}
      // shrink-0: this is a flex item of the column-flex scroll container in
      // GuideDialog, and `overflow-hidden` below makes its automatic minimum
      // size resolve to 0 per CSS Flexbox §4.5 — without shrink-0 all seven
      // sections absorb negative free space by shrinking and clipping instead
      // of the container overflowing.
      className={`shrink-0 overflow-hidden rounded-3xl border ${
        step.isWarning
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
            step.isWarning
              ? // Solid in dark mode too, one step down the ramp to match the
                // heading and icon. Measured: every dimmed variant fails the
                // 4.5:1 this 14px text needs against the warning card
                // (amber-400/20 = 3.42:1, /30 = 4.52:1 only with black text),
                // while solid amber-500 on black is 9.79:1.
                'bg-amber-400 text-black dark:bg-amber-500'
              : 'bg-primary/10 text-primary dark:bg-primary/20'
          }`}
        >
          {step.id}
        </span>
        <div>
          <h3
            id={`${anchorId}-heading`}
            // -1: not in the tab order, but a programmatic focus target — a
            // deep link or a rail tap moves the viewport here, and this is
            // what a keyboard/screen-reader user is focused on once it does.
            tabIndex={-1}
            className={`text-base font-bold font-display md:text-lg ${
              step.isWarning
                ? 'text-amber-800 dark:text-amber-500'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {step.isWarning && (
              <>
                <AlertTriangle
                  size={18}
                  aria-hidden="true"
                  className="me-1.5 inline-block shrink-0 align-[-0.2em] text-amber-600 dark:text-amber-500"
                />
                <span className="sr-only">{t('format.warning')}: </span>
              </>
            )}
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t(`steps.${step.id}.description` as any)}
          </p>
          {/* Step 1 is the only instruction the reader cannot carry out on a
              screen they are already looking at, so it is the only one that
              ships its own control. This link used to stand above section 1
              as a button belonging to no step — which is exactly why the
              guide's numbering did not match the landing page's: the first
              thing the reader has to do was not a step. */}
          {step.externalLink && (
            <a
              href={step.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.linkClick('meta_accounts')}
              className="mt-3 inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 whitespace-normal rounded-2xl bg-primary px-6 py-3 text-center text-sm font-black text-primary-foreground shadow-lg"
            >
              {t('entry.cta')} <ExternalLink size={18} className="shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <ResponsiveGif
        basePath={step.visual}
        alt={t(`steps.${step.id}.alt` as any)}
        isActive={isInView}
        width={posterSize.width}
        height={posterSize.height}
        className="block h-auto w-full"
      />
    </section>
  );
}
