import { Heart, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AFFILIATE_LINKS } from '@/config/affiliate-links';
import type { UserSegment } from '@/lib/rescue-plan/types';

interface EmpathyCardProps {
  segment: UserSegment;
}

/** Empathetic card for critical casual/regular — brand trust play via Peak-End Rule */
export function EmpathyCard({ segment }: EmpathyCardProps) {
  const { t } = useTranslation('results');

  if (segment.severity !== 'critical') return null;
  if (segment.size !== 'casual' && segment.size !== 'regular') return null;

  return (
    <div className="mx-4 mb-4 flex items-start gap-3 rounded-2xl border border-orange-200/50 bg-orange-50/30 p-4 dark:border-orange-900/30 dark:bg-orange-950/10 md:mx-8">
      <Heart size={18} className="mt-0.5 shrink-0 text-orange-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t('rescue.empathy.message' as any)}
        </p>
        <a
          href={AFFILIATE_LINKS.headspace}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
        >
          {t('rescue.empathy.headspaceLink' as any)}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
