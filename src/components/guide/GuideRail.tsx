import { useTranslation } from 'react-i18next';

import { GUIDE_STEPS } from '@/config/wizard-steps';

interface GuideRailProps {
  /** The section the reader is in, or null when the dialog claims none. */
  current: number | null;
  onSelect: (step: number) => void;
}

/**
 * Seven segments, and every one of them is a button.
 *
 * The rail is the only thing in the dialog that looks like navigation once
 * Back/Next are gone, and a segmented bar at the top of a mobile modal is one
 * of the most tapped non-controls in onboarding. The anchors a tap scrolls to
 * exist already — `?step` needs them — so making the rail live costs a
 * handler, and leaving it dead costs a defect.
 *
 * The hydration invariant that governed the wizard's swapped bottom bar does
 * not bind here, and that is worth writing down rather than leaving to be
 * rediscovered: a prerendered anchor's destination must not change in the
 * frame the page becomes interactive, because IntersectionObserver delivers
 * its first callback on observe(). These are <button>s driven by a handler,
 * not anchors with an href — before hydration they simply do nothing, and
 * there is no destination to change under a finger. Turning them into links
 * would reintroduce exactly that.
 */
export function GuideRail({ current, onSelect }: GuideRailProps) {
  const { t } = useTranslation('wizard');

  return (
    <div className="flex flex-col gap-1">
      {current !== null && (
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {t('header.stepOf', { current, total: GUIDE_STEPS.length })}
        </span>
      )}
      <nav className="flex" aria-label={t('header.stepNavigation')}>
        {GUIDE_STEPS.map(step => (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={step.id === current ? 'step' : undefined}
            aria-label={t('header.stepLabel', { step: step.id })}
            className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center px-0.5"
          >
            <span
              aria-hidden="true"
              className={`block h-1.5 w-full rounded-full transition-all duration-300 ${
                // bg-border measures 1.27:1 light / 1.18:1 dark against the
                // card — nowhere near the 3:1 WCAG 1.4.11 floor for a UI
                // component. bg-muted-foreground is the only option that
                // clears it in both themes (4.85:1 / 8.45:1); any alpha on it
                // washes back out against the card's near-white background.
                current !== null && step.id <= current ? 'bg-primary' : 'bg-muted-foreground'
              }`}
            />
          </button>
        ))}
      </nav>
    </div>
  );
}
