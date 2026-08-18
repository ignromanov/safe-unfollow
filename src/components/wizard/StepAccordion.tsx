import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PrefixedLink } from '@/components/PrefixedLink';
import { WIZARD_STEPS } from '@/config/wizard-steps';

/**
 * Poster assets are not one aspect ratio: step 2's is 600x360 (5:3), steps
 * 3-8 are 600x450 (4:3). Real width/height attributes let the browser
 * reserve each row's box from its own intrinsic size before the image
 * loads — forcing every row into 4:3 would crop or letterbox step 2.
 */
const DEFAULT_POSTER_SIZE = { width: 600, height: 450 };
const POSTER_SIZE_OVERRIDES: Partial<Record<number, { width: number; height: number }>> = {
  2: { width: 600, height: 360 },
};

// Step 1 opens Meta's Accounts Center externally; the accordion covers the
// remaining in-app steps only.
const REMAINING_STEPS = WIZARD_STEPS.filter(step => step.id !== 1);

const TRIGGER_ID = 'step-accordion-trigger';

/**
 * One disclosure, seven links. Rows are plain images pointing at each step's
 * poster (no `<video>` on this screen — the moving image lives on the step
 * route the link goes to) and stay unmounted until the row is opened, so
 * opening never shifts layout and nothing is reachable before the click.
 */
export function StepAccordion() {
  const { t } = useTranslation('wizard');
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();

  // Derived from the row list itself, not hardcoded — stays correct if a
  // step is ever added or removed. `_one`/`_other` are the two plural
  // forms every locale's `entry.accordion.trigger` key defines; i18next
  // falls back to `_other` for the mid-range categories some languages
  // add (Russian "few", Arabic "few"/"many"), which is correct at the
  // guide's actual length (7) and only imprecise for a hypothetical 2-4.
  const stepCount = REMAINING_STEPS.length;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/*
        A plain button, not <details>/<summary>: jsdom's native <details>
        toggle behaviour is unreliable under click simulation, and a
        controlled button gives a clean role="button" without leaning on
        <summary>'s implicit ARIA mapping. Nothing here uses <details>, so
        the "replace the default marker for RTL" rule has no marker to
        replace.
      */}
      <button
        id={TRIGGER_ID}
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(open => !open)}
        className="flex h-14 w-full items-center justify-between gap-2 px-4 text-sm font-semibold text-zinc-900 dark:text-white"
      >
        <span className="truncate">{t('entry.accordion.trigger', { count: stepCount })}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          id={listId}
          aria-labelledby={TRIGGER_ID}
          className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {REMAINING_STEPS.map(step => {
            const size = POSTER_SIZE_OVERRIDES[step.id] ?? DEFAULT_POSTER_SIZE;

            return (
              <li key={step.id}>
                <PrefixedLink
                  to={`/wizard/step/${step.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <img
                    src={`${step.visual}-600w-poster.jpg`}
                    alt={t(`steps.${step.id}.alt` as any)}
                    width={size.width}
                    height={size.height}
                    loading="lazy"
                    className="h-auto w-20 shrink-0 rounded-lg"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {t(`steps.${step.id}.title` as any)}
                  </span>
                </PrefixedLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
