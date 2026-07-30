import { useEffect, useRef, useState, type ReactElement } from 'react';

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
    // near, so fall back to loading right away rather than never.
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
    // Fires when the ad is requested, not when the page merely contains a slot
    // — the two diverge now that requests wait for the reader to scroll.
    // Temporary home for this call: a follow-up moves it onto the MRC dwell
    // gate, so it fires on an actual viewable impression rather than a fill
    // request.
    analytics.adSlotViewable(name);
    pushAdSlot(client);
  }, [approaching, eligible, client, name]);

  if (!mounted || !eligible || !client || !slot) {
    return null;
  }

  const isMultiplex = format === 'multiplex';

  return (
    <div
      ref={containerRef}
      className={cn('w-full flex justify-center', !isMultiplex && 'overflow-hidden', className)}
      style={{ minHeight }}
      data-ad-name={name}
    >
      {/* Mounted late on purpose: `adsbygoogle.push({})` fills unprocessed
          `<ins>` elements in document order, so an early-rendered slot further
          up the page would swallow the fill meant for this one. */}
      {approaching && (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', ...(isMultiplex ? {} : { height: minHeight }) }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={isMultiplex ? 'autorelaxed' : 'auto'}
          {...(isMultiplex ? {} : { 'data-full-width-responsive': 'true' })}
        />
      )}
    </div>
  );
}
