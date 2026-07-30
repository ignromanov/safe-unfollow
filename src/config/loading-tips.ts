import { ShieldCheck, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ParseKeys } from 'i18next';

/**
 * Loading Tips Configuration
 *
 * Privacy-themed tips shown during ZIP parsing (Zeigarnik effect — the user is
 * in an active waiting state with elevated attention).
 *
 * Nothing here is paid. The affiliate card that used to sit in this list moved
 * to a persistent block in the `/upload` body: a typical parse lasts 1-3s and
 * 42% of uploads fail on format before parsing starts, so this window reaches
 * almost nobody. See `components/upload/UploadAffiliateBlock.tsx`.
 *
 * The delays are staggered choreography, not pacing: every tip has to land
 * inside the first second because that is all the time a typical parse takes.
 * `upload_parse_duration` measures the real distribution; widen these only
 * against that data.
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
    id: 'revoke-access',
    delayMs: 1100,
    titleKey: 'loadingTips.revokeAccess.title',
    descKey: 'loadingTips.revokeAccess.desc',
    icon: KeyRound,
    color: 'text-blue-600',
  },
];
