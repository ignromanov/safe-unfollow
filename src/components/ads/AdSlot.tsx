import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { useAdViewability } from '@/hooks/useAdViewability';
import { isSampleRoute } from '@/lib/ads/eligibility';
import { pushAdSlot } from '@/lib/ads/loader';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/**
 * AdSense ad unit format.
 *
 * - `display` — responsive banner. Pinned to `minHeight` in both directions,
 *   so it contributes zero CLS whether or not an ad fills it.
 * - `multiplex` — native grid of related-content tiles. It sizes its own rows,
 *   so `minHeight` only reserves space up front and the unit may grow past it.
 *   Use it at the end of a page, where growth pushes nothing but the footer.
 */
export type AdSlotFormat = 'display' | 'multiplex';

export interface AdSlotProps {
  /** Analytics/debug name for this placement (e.g. "home", "results"). */
  name: string;
  /** AdSense ad unit slot ID (from env). When empty, the slot renders nothing. */
  slot: string | undefined;
  /** Ad unit format. Defaults to a responsive display banner. */
  format?: AdSlotFormat;
  /** Reserved height in px for the ad container. */
  minHeight?: number;
  className?: string;
}

/**
 * How far outside the viewport a slot starts loading. Every placement sits
 * below the fold, so nothing is requested until the reader is heading for it —
 * roughly half a mobile viewport of lead time, enough for the script and the
 * fill to land before the slot is actually on screen.
 */
const LAZY_ROOT_MARGIN = '400px 0px';

/**
 * AdSense ad slot.
 *
 * Renders nothing (null, no reserved space) unless ALL conditions hold:
 * - `VITE_ADSENSE_CLIENT` and the placement `slot` are configured
 * - the current route is not `/sample`
 *
 * Consent for EEA/UK/CH visitors is handled by Google's certified CMP on top
 * of the ad script — there is no client-side geo-gate.
 *
 * When eligible it reserves space immediately but stays inert until the slot
 * approaches the viewport ({@link LAZY_ROOT_MARGIN}); only then does the `<ins>`
 * element mount, the AdSense script load, and a fill get requested. Readers who
 * never scroll that far pay nothing for Google's script. See
 * {@link AdSlotFormat} for how each format handles the reserved space.
 */
export function AdSlot({
  name,
  slot,
  format = 'display',
  minHeight = 280,
  className,
}: AdSlotProps): ReactElement | null {
  const { t } = useTranslation('common');
  const client = import.meta.env.VITE_ADSENSE_CLIENT;
  // Client-only: avoid SSG/hydration mismatch since eligibility depends on
  // the runtime route.
  const [mounted, setMounted] = useState(false);
  const [approaching, setApproaching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const eligible = Boolean(client) && Boolean(slot) && !isSampleRoute();

  useEffect(() => {
    if (!mounted || !eligible || approaching) return;

    const container = containerRef.current;
    // Without IntersectionObserver there is no way to tell when the slot is
    // near, so fall back to loading right away rather than never. Note this
    // skews the fill-rate math: `useAdViewability` stays silent under the same
    // condition (see its doc comment), so this path requests a fill — and
    // AdSense counts an impression — while `ad_slot_viewable` never fires for
    // it. The affected population is tiny (browsers without
    // IntersectionObserver), but it inflates the fill rate with no signal to
    // detect it.
    if (!container || typeof IntersectionObserver === 'undefined') {
      setApproaching(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setApproaching(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN }
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, [mounted, eligible, approaching]);

  useEffect(() => {
    if (!approaching || !eligible || pushedRef.current || !client) return;
    pushedRef.current = true;
    pushAdSlot(client);
  }, [approaching, eligible, client]);

  const reportViewable = useCallback(() => {
    analytics.adSlotViewable(name);
  }, [name]);

  // Counts a viewable slot opportunity, not a filled ad: the container keeps
  // its reserved height whether or not a fill arrives. AdSense's own impression
  // count divided by this one is the fill rate, which is the number worth
  // knowing — so matching Google's count exactly buys no extra decision.
  useAdViewability(containerRef, approaching, reportViewable);

  if (!mounted || !eligible || !client || !slot) {
    return null;
  }

  const isMultiplex = format === 'multiplex';
  // Unique per instance: three AdSlots render on the homepage alone, and a
  // duplicated id would break the aria-labelledby association below.
  const labelId = `ad-label-${name}`;

  return (
    <div className={cn('w-full', className)} data-ad-name={name}>
      {/* Required by the distinguishability policy. Small and muted, but it
          must be legible and must not read as our own section heading.
          Colors are measured against this app's page background (--background,
          OKLCH), not a card — every placement sits directly on it. 10px is
          small text, so the exemption for large text (3:1) does not apply;
          it needs the full 4.5:1. Measured: text-zinc-600 on light
          --background ≈7.51:1, text-zinc-400 on dark --background ≈7.92:1.
          The prior zinc-400/zinc-500 pair measured ≈2.6:1 / ≈3.7:1 and failed
          AA on both themes. */}
      <span
        id={labelId}
        className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400"
      >
        {t('ads.label')}
      </span>
      <div
        ref={containerRef}
        aria-labelledby={labelId}
        className={cn('flex w-full justify-center', !isMultiplex && 'overflow-hidden')}
        style={{ minHeight }}
      >
        {/* Mounted late on purpose: `adsbygoogle.push({})` fills unprocessed
            `<ins>` elements in document order, so an early-rendered slot
            further up the page would swallow the fill meant for this one. */}
        {approaching && (
          <ins
            className="adsbygoogle"
            style={{
              display: 'block',
              width: '100%',
              ...(isMultiplex ? {} : { height: minHeight }),
            }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format={isMultiplex ? 'autorelaxed' : 'auto'}
            {...(isMultiplex ? {} : { 'data-full-width-responsive': 'true' })}
          />
        )}
      </div>
    </div>
  );
}
