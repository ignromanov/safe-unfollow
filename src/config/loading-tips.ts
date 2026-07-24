import { ShieldCheck, Wifi, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { AFFILIATE_LINKS } from './affiliate-links';

/**
 * Loading Tips Configuration
 *
 * Privacy-themed tips shown during ZIP parsing (Zeigarnik effect — the user
 * is in an active waiting state with elevated attention). Only the NordVPN
 * tip carries an affiliate link; `LoadingTips` filters it out when
 * `VITE_NORDVPN_URL` is unset, leaving the other tips untouched.
 */

export interface LoadingTip {
  id: string;
  delayMs: number;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  color: string;
  /** Present only for the affiliate tip; empty string hides the tip. */
  url?: string;
}

export const LOADING_TIPS: LoadingTip[] = [
  {
    id: 'local-processing',
    delayMs: 1000,
    titleKey: 'loadingTips.localProcessing.title',
    descKey: 'loadingTips.localProcessing.desc',
    icon: ShieldCheck,
    color: 'text-emerald-500',
  },
  {
    id: 'nordvpn',
    delayMs: 5000,
    titleKey: 'loadingTips.nordvpn.title',
    descKey: 'loadingTips.nordvpn.desc',
    icon: Wifi,
    color: 'text-teal-500',
    url: AFFILIATE_LINKS.nordvpn,
  },
  {
    id: 'revoke-access',
    delayMs: 10000,
    titleKey: 'loadingTips.revokeAccess.title',
    descKey: 'loadingTips.revokeAccess.desc',
    icon: KeyRound,
    color: 'text-blue-600',
  },
];
