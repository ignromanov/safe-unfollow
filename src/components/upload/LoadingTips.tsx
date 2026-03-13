import { useState, useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LOADING_TIPS } from '@/config/loading-tips';
import { analytics } from '@/lib/analytics';

interface LoadingTipsProps {
  isProcessing: boolean;
}

/** Progressive affiliate mini-cards shown during file processing */
export function LoadingTips({ isProcessing }: LoadingTipsProps) {
  const { t } = useTranslation('upload');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isProcessing) {
      setVisibleIds(new Set());
      return;
    }

    startTimeRef.current = Date.now();

    const timers = LOADING_TIPS.map((tip, index) =>
      setTimeout(() => {
        setVisibleIds(prev => new Set([...prev, tip.id]));
        analytics.loadingTipImpression(tip.id, index, tip.delayMs);
      }, tip.delayMs)
    );

    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  if (!isProcessing) return null;

  const visibleTips = LOADING_TIPS.filter(tip => visibleIds.has(tip.id));
  if (visibleTips.length === 0) return null;

  const handleClick = (tipId: string, index: number) => {
    const elapsed = Date.now() - startTimeRef.current;
    analytics.loadingTipClick(tipId, index, elapsed);
  };

  return (
    <div className="mt-6 space-y-3 max-w-sm mx-auto">
      {visibleTips.map((tip, index) => (
        <a
          key={tip.id}
          href={tip.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleClick(tip.id, index)}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/80 p-3 text-start shadow-sm backdrop-blur transition-all hover:border-primary/50 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300 dark:border-zinc-700 dark:bg-zinc-800/80"
        >
          <div className={`shrink-0 ${tip.color}`}>
            <tip.icon size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
              {t(tip.titleKey as any)}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {t(tip.descKey as any)}
            </p>
          </div>
          <ExternalLink
            size={14}
            className="shrink-0 text-zinc-300 dark:text-zinc-600"
            aria-hidden="true"
          />
        </a>
      ))}
    </div>
  );
}
