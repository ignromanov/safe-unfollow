import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

/**
 * Says out loud that `Not Following Back` may be overstated (GH#41).
 *
 * The badge is still computed and still shown — it is the best answer we have,
 * and rendering `0 Not Following Back` instead would read as good news and lie
 * in the other direction. So the list stays and carries a mark.
 *
 * The closing sentence is load-bearing — without it a reader who distrusts one
 * number distrusts the page — but it names only what is actually safe. It used
 * to say "everything else on this page is unaffected", which was false about
 * this very file: `badges.pending` and `badges.permanent` read the same two
 * maps (`core/badges/index.ts:58-60`), so they fall to 0 and `FilterChips`
 * sweeps them into "empty categories". The page was already claiming "no
 * pending requests" off the unreadable file, and this notice was vouching for
 * it. `followers`, `following` and `mutuals` are derived without those maps and
 * are the only counts named.
 *
 * `role="status"` overrides the primitive's `role="alert"`: the caveat is
 * inserted into the page after paint, once the stored flag resolves, and an
 * assertive live region interrupts a screen reader mid-announcement to say
 * something that is advisory rather than urgent.
 */
export function FollowRequestsCaveat() {
  const { t } = useTranslation('results');

  return (
    <Alert
      role="status"
      className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 line-clamp-none">
        {t('caveat.followRequests.title')}
      </AlertTitle>
      <AlertDescription className="block text-amber-700 dark:text-amber-300">
        {t('caveat.followRequests.body')}
      </AlertDescription>
    </Alert>
  );
}
