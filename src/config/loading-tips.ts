import { Shield, PenLine, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { AFFILIATE_LINKS } from './affiliate-links';

/**
 * Loading Tips Configuration
 *
 * Progressive affiliate mini-cards shown during file processing.
 * Tips appear at staggered intervals (Zeigarnik Effect — user is in
 * active waiting state, attention is elevated).
 *
 * No segmentation possible here — data isn't parsed yet.
 * Universal privacy + productivity recommendations only.
 */

export interface LoadingTip {
  id: string;
  delayMs: number;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  url: string;
  color: string;
}

export const LOADING_TIPS: LoadingTip[] = [
  {
    id: 'nordprotect',
    delayMs: 1000,
    titleKey: 'loadingTips.nordprotect.title',
    descKey: 'loadingTips.nordprotect.desc',
    icon: Shield,
    url: AFFILIATE_LINKS.nordprotect,
    color: 'text-teal-500',
  },
  {
    id: 'grammarly',
    delayMs: 5000,
    titleKey: 'loadingTips.grammarly.title',
    descKey: 'loadingTips.grammarly.desc',
    icon: PenLine,
    url: AFFILIATE_LINKS.grammarly,
    color: 'text-green-500',
  },
  {
    id: 'nordpass',
    delayMs: 10000,
    titleKey: 'loadingTips.nordpass.title',
    descKey: 'loadingTips.nordpass.desc',
    icon: KeyRound,
    url: AFFILIATE_LINKS.nordpass,
    color: 'text-blue-600',
  },
];
