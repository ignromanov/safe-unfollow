import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { resolveAffiliateOffer } from '@/config/affiliate-offers';
import { analytics } from '@/lib/stats';

import type { ReactElement } from 'react';

/**
 * Persistent affiliate placement in the `/upload` body.
 *
 * It lives here rather than in the parsing spinner because a typical parse
 * lasts 1-3s and 42% of uploads fail on format before parsing even starts —
 * the loading window reached almost nobody. On this page the offer is exposed
 * for the whole visit.
 *
 * The offer comes from the locale, because the affiliate network excludes
 * Russia, Turkey, China and the higher-income Arabic markets from its main
 * offer and covers them with dedicated ones. See `config/affiliate-offers.ts`
 * for how approximate that mapping is.
 *
 * No impression event: the block always renders, so `/upload` pageviews are
 * already the denominator. Only the click carries new information.
 */
export function UploadAffiliateBlock(): ReactElement | null {
  // i18next, not the URL: this page is prerendered for 11 languages and reading
  // `window.location` would resolve a different offer at build time than after
  // hydration.
  const { t, i18n } = useTranslation('upload');
  const offer = resolveAffiliateOffer(i18n.language);

  if (offer === null) return null;

  const { creative } = offer;

  return (
    <aside className="flex flex-col gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-5 mt-3">
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => analytics.affiliateBlockClick(offer.id)}
        className="block text-start"
      >
        {creative ? (
          // The creative is a finished advertisement with its own headline and
          // its own button. Our line no longer leads it — it drops to a label
          // beside an "Ad" chip, above the image, and exists only to supply the
          // message-match the generic ad creative has none of.
          <>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="shrink-0 rounded border border-zinc-300 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
                {t('affiliate.adLabel')}
              </span>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t(`affiliate.${offer.copyKey}.title` as any)}
              </p>
            </div>
            <img
              src={creative.base.src}
              width={creative.base.width}
              height={creative.base.height}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-auto rounded-xl ring-1 ring-black/5 dark:ring-white/10"
            />
          </>
        ) : (
          <div className="flex items-start gap-3">
            <span className="shrink-0 pt-0.5 text-teal-500">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {t(`affiliate.${offer.copyKey}.title` as any)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                {t(`affiliate.${offer.copyKey}.desc` as any)}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-zinc-400 dark:text-zinc-500">
              <ExternalLink size={14} aria-hidden="true" />
            </span>
          </div>
        )}
        <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          {t('affiliate.disclosure')}
        </p>
        <span className="sr-only">{t('affiliate.opensInNewTab')}</span>
      </a>
    </aside>
  );
}
