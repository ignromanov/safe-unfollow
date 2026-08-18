import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Row order: "destination" leads because it is the row that must survive the
 * fold cut on a 360px viewport — see task-2-brief.md, Q2/Q3. The remaining
 * rows keep the source table's order.
 */
const ROW_KEYS = ['destination', 'range', 'format', 'quality', 'content'] as const;

const TITLE_ID = 'recipe-card-title';

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
      <h3 id={TITLE_ID} className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
        {t('entry.recipe.title')}
      </h3>
      <ul className="space-y-2">
        {ROW_KEYS.map(key => (
          <li key={key} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>
              {key === 'format'
                ? renderFormatRow(t('entry.recipe.rows.format'))
                : t(`entry.recipe.rows.${key}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "JSON" is the one Latin token every translation keeps verbatim inside an
 * otherwise-translated sentence. Isolate it in its own `dir="ltr"` span so it
 * doesn't get mirrored inside RTL rows (same reasoning as the error-code
 * badge at DiagnosticErrorScreen.tsx:192-195).
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
