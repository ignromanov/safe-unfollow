import { useState, useEffect, useMemo, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LOADING_TIPS } from '@/config/loading-tips';
import { analytics } from '@/lib/stats';

interface LoadingTipsProps {
  isProcessing: boolean;
}

/** Privacy tips (plus one NordVPN affiliate card) shown while a ZIP is parsing */
export function LoadingTips({ isProcessing }: LoadingTipsProps) {
  const { t } = useTranslation('upload');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const startTimeRef = useRef<number>(0);

  // Tips without a url always show; the affiliate tip is hidden when its link is unset.
  const tips = useMemo(
    () => LOADING_TIPS.filter(tip => tip.url === undefined || tip.url.length > 0),
    []
  );

  useEffect(() => {
    if (!isProcessing) {
      setVisibleIds(new Set());
      return;
    }

    startTimeRef.current = Date.now();

    const timers = tips.map((tip, index) =>
      setTimeout(() => {
        setVisibleIds(prev => new Set([...prev, tip.id]));
        analytics.loadingTipImpression(tip.id, index, tip.delayMs);
      }, tip.delayMs)
    );

    return () => timers.forEach(clearTimeout);
  }, [isProcessing, tips]);

  if (!isProcessing) return null;

  const visibleTips = tips.filter(tip => visibleIds.has(tip.id));
  if (visibleTips.length === 0) return null;

  const handleClick = (tipId: string, index: number) => {
    const elapsed = Date.now() - startTimeRef.current;
    analytics.loadingTipClick(tipId, index, elapsed);
  };

  const cardClassName =
    'flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/80 p-3 text-start shadow-sm backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-300 dark:border-zinc-700 dark:bg-zinc-800/80';

  return (
    <div className="mt-6 space-y-3 max-w-sm mx-auto">
      {visibleTips.map((tip, index) => {
        const Icon = tip.icon;
        const body = (
          <>
            <div className={`shrink-0 ${tip.color}`}>
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                {t(tip.titleKey as any)}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {t(tip.descKey as any)}
              </p>
              {tip.url && (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {t('loadingTips.affiliateDisclosure')}
                </p>
              )}
            </div>
          </>
        );

        if (!tip.url) {
          return (
            <div key={tip.id} className={cardClassName}>
              {body}
            </div>
          );
        }

        return (
          <a
            key={tip.id}
            href={tip.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(tip.id, index)}
            className={`${cardClassName} transition-all hover:border-primary/50 hover:shadow-md`}
          >
            {body}
            <ExternalLink
              size={14}
              className="shrink-0 text-zinc-300 dark:text-zinc-600"
              aria-hidden="true"
            />
          </a>
        );
      })}
    </div>
  );
}
