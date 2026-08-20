import { useTranslation } from 'react-i18next';
import { CaveatAlert } from './CaveatAlert';

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
 * The amber shell, the warning icon and the `role="status"` override live in
 * `CaveatAlert`, shared with the truncation caveat — that override is an
 * accessibility decision rather than styling, and it was previously held, and
 * explained, in two files at once.
 */
export function FollowRequestsCaveat() {
  const { t } = useTranslation('results');

  return (
    <CaveatAlert title={t('caveat.followRequests.title')} body={t('caveat.followRequests.body')} />
  );
}
