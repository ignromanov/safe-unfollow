import { useTranslation } from 'react-i18next';

/**
 * One sentence for a stored file that predates follow dates. Owns its own
 * `isSample` check because `AccountListSection` has no complexity budget left
 * for another condition. No control and no analytics: the only remedy is the
 * re-upload the sentence names.
 */
export function StaleDatesHint({ stale, isSample }: { stale: boolean; isSample: boolean }) {
  const { t } = useTranslation('results');

  if (!stale || isSample) return null;

  return <p className="mt-2 text-xs text-muted-foreground">{t('dates.staleHint')}</p>;
}
