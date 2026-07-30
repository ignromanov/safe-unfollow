import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LOADING_TIPS } from '@/config/loading-tips';
import { analytics } from '@/lib/stats';

interface LoadingTipsProps {
  isProcessing: boolean;
}

// items-start, not items-center: long locales (ru/de/fr) wrap the description
// and disclosure to ~8 lines at 320px, which would leave the icon floating in
// the middle of a ~150px card instead of next to the title it belongs to.
const CARD_CLASS =
  'flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/80 p-3 text-start shadow-sm backdrop-blur transition-all duration-300 dark:border-zinc-700 dark:bg-zinc-800/80';

/** Privacy tips shown while a ZIP is parsing */
export function LoadingTips({ isProcessing }: LoadingTipsProps) {
  const { t } = useTranslation('upload');
  // Tips reveal cumulatively in config order, so a single count is enough and
  // the render index always matches the index reported to analytics.
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setVisibleCount(0);
      return;
    }

    const timers = LOADING_TIPS.map((tip, index) =>
      setTimeout(() => {
        setVisibleCount(index + 1);
        analytics.loadingTipImpression(tip.id, index, tip.delayMs);
      }, tip.delayMs)
    );

    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  if (!isProcessing || LOADING_TIPS.length === 0) return null;

  return (
    // Every card stays mounted and reserves its space from the start: revealing
    // one animates opacity/transform only, so it cannot contribute to CLS.
    // No top margin: the parent in UploadZone is a `flex flex-col gap-8`, so
    // spacing above the list is already the parent's job. An mt-* here stacks
    // on top of that gap and pushes the cards away from the spinner.
    <ul className="mx-auto w-full max-w-sm space-y-3">
      {LOADING_TIPS.map((tip, index) => {
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
            </div>
          </>
        );

        return (
          // aria-hidden keeps not-yet-revealed cards out of the a11y tree while
          // they hold their layout space.
          <li key={tip.id} aria-hidden={!isVisible}>
            <div className={`${CARD_CLASS} ${revealClass}`}>{body}</div>
          </li>
        );
      })}
    </ul>
  );
}
