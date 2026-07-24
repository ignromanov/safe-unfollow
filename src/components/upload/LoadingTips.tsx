import { useState, useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { VISIBLE_LOADING_TIPS } from '@/config/loading-tips';
import { analytics } from '@/lib/stats';

interface LoadingTipsProps {
  isProcessing: boolean;
}

// items-start, not items-center: long locales (ru/de/fr) wrap the description
// and disclosure to ~8 lines at 320px, which would leave the icon floating in
// the middle of a ~150px card instead of next to the title it belongs to.
const CARD_CLASS =
  'flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/80 p-3 text-start shadow-sm backdrop-blur transition-all duration-300 dark:border-zinc-700 dark:bg-zinc-800/80';

/** Privacy tips (plus one NordVPN affiliate card) shown while a ZIP is parsing */
export function LoadingTips({ isProcessing }: LoadingTipsProps) {
  const { t } = useTranslation('upload');
  // Tips reveal cumulatively in config order, so a single count is enough and
  // the render index always matches the index reported to analytics.
  const [visibleCount, setVisibleCount] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isProcessing) {
      setVisibleCount(0);
      return;
    }

    startTimeRef.current = Date.now();

    const timers = VISIBLE_LOADING_TIPS.map((tip, index) =>
      setTimeout(() => {
        setVisibleCount(index + 1);
        analytics.loadingTipImpression(tip.id, index, tip.delayMs);
      }, tip.delayMs)
    );

    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  if (!isProcessing || VISIBLE_LOADING_TIPS.length === 0) return null;

  const handleClick = (tipId: string, index: number) => {
    analytics.loadingTipClick(tipId, index, Date.now() - startTimeRef.current);
  };

  return (
    // Every card stays mounted and reserves its space from the start: revealing
    // one animates opacity/transform only, so it cannot contribute to CLS.
    // No top margin: the parent in UploadZone is a `flex flex-col gap-8`, so
    // spacing above the list is already the parent's job. An mt-* here stacks
    // on top of that gap and pushes the cards away from the spinner.
    <ul className="mx-auto w-full max-w-sm space-y-3">
      {VISIBLE_LOADING_TIPS.map((tip, index) => {
        const Icon = tip.icon;
        const isVisible = index < visibleCount;
        const revealClass = isVisible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0';

        const body = (
          <>
            <div className={`shrink-0 ${tip.color}`}>
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                {t(tip.titleKey)}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">{t(tip.descKey)}</p>
              {tip.url && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('loadingTips.affiliateDisclosure')}
                </p>
              )}
            </div>
          </>
        );

        return (
          // aria-hidden keeps not-yet-revealed cards out of the a11y tree while
          // they hold their layout space.
          <li key={tip.id} aria-hidden={!isVisible}>
            {tip.url ? (
              <a
                href={tip.url}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isVisible ? undefined : -1}
                onClick={() => handleClick(tip.id, index)}
                className={`${CARD_CLASS} ${revealClass} hover:border-primary/50 hover:shadow-md`}
              >
                {body}
                <ExternalLink
                  size={14}
                  className="shrink-0 text-zinc-400 dark:text-zinc-500"
                  aria-hidden="true"
                />
                <span className="sr-only">{t('loadingTips.opensInNewTab')}</span>
              </a>
            ) : (
              <div className={`${CARD_CLASS} ${revealClass}`}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
