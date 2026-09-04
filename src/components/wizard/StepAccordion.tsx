import { useId, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { GUIDE_STEPS, guideStepPosterSize } from '@/config/wizard-steps';

interface StepAccordionProps {
  /**
   * Open the guide dialog at a section. Optional because `UploadZone`'s own
   * `onOpenGuide` is optional and forwarded straight through, so a `UploadZone`
   * rendered without it leaves these rows inert. `/upload` always supplies it
   * (UploadPage.tsx), which is every production render.
   */
  onSelect?: (step: number) => void;
}

/**
 * One disclosure, one row per step. Rows are plain images pointing at each step's
 * poster (no `<video>` on this screen — the moving image lives in the guide
 * dialog section the row opens) and stay unmounted until the row is opened, so
 * opening never shifts layout and nothing is reachable before the click.
 */
export function StepAccordion({ onSelect }: StepAccordionProps = {}) {
  const { t } = useTranslation('wizard');
  const [isOpen, setIsOpen] = useState(false);
  // Both ids come from useId, because UploadZone mounts this block twice —
  // once for mobile, once for the desktop sidebar, both always in the DOM and
  // toggled by `display`. A module-level constant id would put two elements
  // with the same id in one document, and the second `aria-labelledby` would
  // resolve to the first accordion's trigger.
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const listId = `${baseId}-list`;

  // Derived from the row list itself, not hardcoded — stays correct if a
  // step is ever added or removed. `entry.accordion.trigger` is a single,
  // un-suffixed key in every locale — not `_one`/`_other`. i18next only
  // consults CLDR plural categories (`_one`, `_few`, `_many`, `_other`, ...)
  // when a suffixed form exists for the resolved category; with none
  // defined, it falls through to the bare key and interpolates `{{count}}`
  // as plain text. That fallback is the point here: the guide's length is
  // always ≥2 in practice, so a single generic-plural string is correct at
  // every real count, and — unlike a `_one`/`_other` split — it can never
  // land on a CLDR category (Russian "few"/"many", Arabic "few"/"many", ...)
  // that has no matching key.
  const stepCount = GUIDE_STEPS.length;

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
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(open => !open)}
        className="flex min-h-14 w-full items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-white"
      >
        {/* No `truncate`: German and Russian, plus the step count, are the
            long cases at 360px, and clipping would risk cutting the count
            itself. The row wraps instead — `min-h-14` (not `h-14`) lets it
            grow past one line rather than clip. */}
        <span>{t('entry.accordion.trigger', { count: stepCount })}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          id={listId}
          aria-labelledby={triggerId}
          className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {GUIDE_STEPS.map(step => {
            const size = guideStepPosterSize(step.id);

            return (
              <li key={step.id}>
                {/* A button, not a link, and that costs nothing here: the
                    rows do not exist until the disclosure above is clicked, so
                    they were never reachable in the pre-hydration window a
                    real href exists to serve. */}
                <button
                  type="button"
                  onClick={() => onSelect?.(step.id)}
                  className="flex w-full items-center gap-3 p-3 text-start hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  {/* Decorative here, hence the empty alt: the row's whole
                      content is the link's accessible name, so a described
                      poster ("Step 2: Choose your Instagram profile") would
                      be announced back to back with the visible label that
                      already names the row. `steps.N.alt` stays in the
                      bundles because GuideStepSection still reads it for the
                      dialog's own images — not because of the step pages,
                      which no longer exist. */}
                  <img
                    src={`${step.visual}-600w-poster.jpg`}
                    alt=""
                    width={size.width}
                    height={size.height}
                    loading="lazy"
                    className="h-auto w-20 shrink-0 rounded-lg"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {step.isWarning && (
                      <>
                        <AlertTriangle
                          size={16}
                          aria-hidden="true"
                          className="me-1 inline-block shrink-0 align-[-0.2em] text-amber-600 dark:text-amber-500"
                        />
                        <span className="sr-only">{t('format.warning')}: </span>
                      </>
                    )}
                    {t(`steps.${step.id}.title` as any)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
