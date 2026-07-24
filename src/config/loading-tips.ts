import { ShieldCheck, EyeOff, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ParseKeys } from 'i18next';

import { AFFILIATE_LINKS } from './affiliate-links';

/**
 * Loading Tips Configuration
 *
 * Privacy-themed tips shown during ZIP parsing (Zeigarnik effect — the user
 * is in an active waiting state with elevated attention). Only the NordVPN
 * tip carries an affiliate link; blanking that link in `affiliate-links.ts`
 * drops the tip from `VISIBLE_LOADING_TIPS` and leaves the others untouched.
 *
 * The delays are staggered choreography, not pacing: every tip has to land
 * inside the first second because that is all the time a typical parse takes.
 * 80% of users hold under 3k accounts, and the 42% of uploads that fail on
 * format fail sooner still — a tip scheduled at 5s is a tip almost nobody
 * sees. `upload_parse_duration` measures the real distribution; widen these
 * only against that data.
 */

export interface LoadingTip {
  id: string;
  /**
   * Must stay ascending across the list — tips are revealed cumulatively —
   * and inside the reveal budget asserted in `__tests__/config/loading-tips`.
   */
  delayMs: number;
  titleKey: ParseKeys<'upload'>;
  descKey: ParseKeys<'upload'>;
  icon: LucideIcon;
  color: string;
  /** Present only for the affiliate tip; empty string hides the tip. */
  url?: string;
}

export const LOADING_TIPS: readonly LoadingTip[] = [
  {
    id: 'local-processing',
    delayMs: 800,
    titleKey: 'loadingTips.localProcessing.title',
    descKey: 'loadingTips.localProcessing.desc',
    icon: ShieldCheck,
    color: 'text-emerald-500',
  },
  {
    id: 'nordvpn',
    delayMs: 950,
    titleKey: 'loadingTips.nordvpn.title',
    descKey: 'loadingTips.nordvpn.desc',
    icon: EyeOff,
    color: 'text-teal-500',
    url: AFFILIATE_LINKS.nordvpn,
  },
  {
    id: 'revoke-access',
    delayMs: 1100,
    titleKey: 'loadingTips.revokeAccess.title',
    descKey: 'loadingTips.revokeAccess.desc',
    icon: KeyRound,
    color: 'text-blue-600',
  },
];

/**
 * Tips actually rendered. Computed once at module load: a tip carrying a `url`
 * is affiliate-funded and is dropped when that link is unset, so the reveal
 * indices stay stable and match the analytics `tip_index`.
 */
export const VISIBLE_LOADING_TIPS: readonly LoadingTip[] = LOADING_TIPS.filter(
  tip => tip.url === undefined || tip.url.length > 0
);
