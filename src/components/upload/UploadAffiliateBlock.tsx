import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { resolveAffiliateOffer } from '@/config/affiliate-offers';
import { analytics } from '@/lib/stats';

import type { ReactElement } from 'react';

/**
 * Tailwind's default `lg`. Hard-coded because a `<source media>` query is a
 * string the CSS engine never sees — it cannot inherit the framework's value.
 * `tailwind.config.js` overrides `screens` only inside `container`, so the
 * global scale is untouched; if that ever changes, this must change with it.
 */
const LG_BREAKPOINT_PX = 1024;

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
    <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => analytics.affiliateBlockClick(offer.id)}
        className="block text-start"
      >
        {creative ? (
          // Our line leads, their ad closes. The creative is a finished
          // advertisement with its own headline and its own button, so our body
          // copy is omitted here: side by side it would be two pitches in one
          // clickable box. Our line supplies the message-match the generic ad
          // creative has none of.
          <>
            <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
              {t(`affiliate.${offer.copyKey}.title` as any)}
            </p>
            <picture>
              {creative.wide ? (
                <source
                  media={`(min-width: ${LG_BREAKPOINT_PX}px)`}
                  srcSet={creative.wide.src}
                  width={creative.wide.width}
                  height={creative.wide.height}
                />
              ) : null}
              {/* `max-w-full` without `w-full`: the image settles at its own
                  intrinsic width and shrinks only when the column is narrower.
                  That keeps the cap out of the className — a hard-coded
                  `max-w-[300px]` would be a second copy of a number the
                  registry already owns, free to drift away from the file. */}
              <img
                src={creative.base.src}
                width={creative.base.width}
                height={creative.base.height}
                alt=""
                loading="lazy"
                decoding="async"
                className="mx-auto block h-auto max-w-full rounded-lg"
              />
            </picture>
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
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('affiliate.disclosure')}</p>
        <span className="sr-only">{t('affiliate.opensInNewTab')}</span>
      </a>
    </aside>
  );
}
