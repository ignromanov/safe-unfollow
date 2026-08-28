import { AlertTriangle, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Row order: "destination" leads because it is the row that must survive the
 * fold cut on a 360px viewport — see task-2-brief.md, Q2/Q3. The remaining
 * rows keep the source table's order.
 */
const ROW_KEYS = ['destination', 'range', 'format', 'quality', 'content'] as const;

const TITLE_ID = 'recipe-card-title';

/**
 * The one row that is not a checklist item.
 *
 * It used to be `format`, because HTML was the failure that dominated the
 * site. The transcoder reads HTML, so that row is now a preference and the
 * marker follows the setting that still decides whether there is an answer at
 * all: `content`. Step 4 carries the same marker in `wizard-steps.ts` and in
 * `HowToSection`, and did so before this change — this row is catching up with
 * them, not making a new claim. Five identical green checks say all five are
 * equally easy; the marked row is the only thing on this screen that says
 * otherwise.
 *
 * The amber is the register `getColorScheme` (lib/errors/diagnostic-utils)
 * paints the same failure in once it has happened, so a reader who ignores
 * the warning meets the same colour on the error screen. Weight is
 * `font-semibold`, not the artboard's `font-bold`: amber body copy runs
 * normal weight everywhere else in that register, and `font-bold` at 14px
 * across ten locales reads as shouting rather than as emphasis.
 *
 * Negative margin rather than the artboard's plain `px-2`: the pill bleeds
 * outward so the icon column stays aligned with the four unmarked rows. An
 * indented warning row would break the checklist's left edge, which is the
 * thing that makes it read as a list at all.
 */
const WARNING_ROW_KEY = 'content';

/**
 * The recipe card is a reference, not a second set of instructions: it is the
 * only place on the entry screen where a setting *value* (JSON, All time, ...)
 * appears — step summaries elsewhere name actions, never values. Rows carry no
 * ordinals so it never reads as a competing numbered list next to the guide.
 */
export function RecipeCard() {
  const { t } = useTranslation('wizard');

  return (
    <div
      role="group"
      aria-labelledby={TITLE_ID}
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Eyebrow register, not a heading: this card is reference material
          sitting under the screen's single action, and a second dark
          semibold line competes with the h2 above the CTA for the same
          attention. `text-eyebrow` is the design system's own label
          register — see DiagnosticErrorScreen.tsx:145, StatCard.tsx:52. */}
      <h3
        id={TITLE_ID}
        className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
      >
        {t('entry.recipe.title')}
      </h3>
      <ul className="space-y-2">
        {ROW_KEYS.map(key => {
          const isWarning = key === WARNING_ROW_KEY;
          const isFormat = key === 'format';

          return (
            <li
              key={key}
              className={
                isWarning
                  ? '-mx-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400'
                  : 'flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300'
              }
            >
              {/* Both icons are aria-hidden: the row's text already carries
                  the whole message ("Followers and following"), so nothing here
                  is conveyed by colour or glyph alone. */}
              {isWarning ? (
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-500"
                  aria-hidden="true"
                />
              ) : (
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
              )}
              <span>
                {isFormat
                  ? renderFormatRow(t('entry.recipe.rows.format'))
                  : t(`entry.recipe.rows.${key}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Every one of the ten `entry.recipe.rows.format` values keeps two Latin
 * tokens verbatim — `JSON` and `HTML` — and only the first is isolated in a
 * `dir="ltr"` span. That is a precaution rather than a fix for a live defect:
 * `ar` is the only RTL locale here and it opens the row with `JSON`, where
 * the bidi algorithm resolves it correctly unaided. The span is what keeps
 * that true if a future RTL locale places the token mid-sentence (same
 * reasoning as the error-code badge at DiagnosticErrorScreen.tsx:192-195).
 *
 * `HTML` is left unwrapped for the same reason inverted: it is string-final
 * in `ar`, and the two locales that place it mid-string (`ja`, `tr`) are LTR,
 * where isolation would be a no-op.
 */
function renderFormatRow(text: string) {
  const index = text.indexOf('JSON');
  if (index === -1) return text;

  const before = text.slice(0, index);
  const after = text.slice(index + 'JSON'.length);

  return (
    <>
      {before}
      <span dir="ltr">JSON</span>
      {after}
    </>
  );
}
