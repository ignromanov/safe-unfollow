import { useTranslation } from 'react-i18next';

import { ResponsiveGif } from '@/components/ResponsiveGif';
import type { GuideStep } from '@/config/wizard-steps';

/**
 * The heading strips the warning prefix; the copy key keeps it.
 *
 * Here the amber card and the amber number already say "careful" — the prefix
 * would be a third carrier of one message. StepAccordion renders the same key
 * on a plain row with no amber of its own, and that row is where a scanning
 * reader decides what to read, so the string itself must keep it.
 */
const WARNING_PREFIX = /^⚠️\s*/u;

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
  const title = t(`steps.${step.id}.title` as any).replace(WARNING_PREFIX, '');

  return (
    <section
      id={`guide-step-${step.id}`}
      aria-labelledby={`guide-step-${step.id}-heading`}
      className={`scroll-mt-4 overflow-hidden rounded-3xl border ${
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
              ? 'bg-amber-400 text-black'
              : 'bg-primary/10 text-primary dark:bg-primary/20'
          }`}
        >
          {step.id}
        </span>
        <div>
          <h3
            id={`guide-step-${step.id}-heading`}
            className={`text-base font-bold leading-tight md:text-lg ${
              step.isWarning
                ? 'text-amber-800 dark:text-amber-500'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t(`steps.${step.id}.description` as any)}
          </p>
        </div>
      </div>

      <ResponsiveGif
        basePath={step.visual}
        alt={t(`steps.${step.id}.alt` as any)}
        isActive={isInView}
        className="block h-auto w-full"
      />
    </section>
  );
}
