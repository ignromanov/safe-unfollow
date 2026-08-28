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
        {GUIDE_STEPS.map(step => {
          const reached = current !== null && step.id <= current;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={step.id === current ? 'step' : undefined}
              aria-label={t('header.stepLabel', { step: step.id })}
              className="flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-0.5"
            >
              {/* The numeral is what makes this read as seven steps rather
                  than one progress bar: the bar alone is 6px of a 44px tap
                  target, with no border, fill or pressed state to say it is a
                  control. aria-hidden because the button is already named
                  "Step N" — a screen reader would otherwise hear the number
                  twice. text-primary is NOT available here: it measures
                  4.06:1 on the card in light mode, which clears the 3:1 a UI
                  component needs but not the 4.5:1 this text does. */}
              <span
                aria-hidden="true"
                className={`text-xs font-bold leading-none ${
                  reached ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.id}
              </span>
              <span
                aria-hidden="true"
                // Named, because the numeral above is also a span and every
                // test that reached for the fill did it with
                // `button.querySelector('span')` — which now returns the
                // numeral instead, silently asserting against the wrong node.
                data-slot="rail-fill"
                className={`block h-1.5 w-full rounded-full transition-all duration-300 ${
                  // bg-border measures 1.27:1 light / 1.18:1 dark against the
                  // card — nowhere near the 3:1 WCAG 1.4.11 floor for a UI
                  // component. bg-muted-foreground is the only option that
                  // clears it in both themes (4.85:1 / 8.45:1); any alpha on it
                  // washes back out against the card's near-white background.
                  reached ? 'bg-primary' : 'bg-muted-foreground'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
