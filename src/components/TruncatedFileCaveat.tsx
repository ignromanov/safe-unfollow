import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TruncatedRelationshipFile } from '@/core/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

/**
 * Says out loud that four counts on this page are wrong, because one of the two
 * required files arrived short.
 *
 * Meta's export dialog offers a date range, and choosing one filters
 * `followers_*.json` by entry timestamp while leaving `following.json` whole.
 * Measured on a real export: `notFollowingBack` 95 -> 294 and mutuals 298 -> 99,
 * with no warning anywhere.
 *
 * The counts are still shown. They are the best answer available from what
 * Instagram actually handed over, and blanking them would read as "you have no
 * mutuals" — a different wrong answer, delivered with the same confidence.
 *
 * **No dates, deliberately.** The natural phrasing names both files' starting
 * months, and this codebase has no localized date rendering at all — no
 * `Intl.DateTimeFormat`, no formatter, nothing but `{{count, number}}` — so
 * ten locales would each need machinery invented for one banner. The copy
 * carries no interpolation at all as a result, which also keeps it clear of
 * the CLDR plural categories that `mockI18n` cannot reproduce.
 *
 * **No diagnosis either.** A genuinely late-blooming account produces the same
 * shape, so the text states what was observed and names the one action that
 * settles it, rather than telling the reader what Instagram did.
 *
 * `role="status"` overrides the primitive's `role="alert"`, for the reason its
 * GH#41 sibling documents: this is inserted after paint once the stored flag
 * resolves, and an assertive live region would interrupt a screen reader
 * mid-announcement to say something advisory.
 */
export function TruncatedFileCaveat({ truncated }: { truncated: TruncatedRelationshipFile }) {
  const { t } = useTranslation('results');

  if (truncated === null) return null;

  return (
    <Alert
      role="status"
      className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 line-clamp-none">
        {t(`caveat.truncated.${truncated}.title`)}
      </AlertTitle>
      <AlertDescription className="block text-amber-700 dark:text-amber-300">
        {t(`caveat.truncated.${truncated}.body`)}
      </AlertDescription>
    </Alert>
  );
}
