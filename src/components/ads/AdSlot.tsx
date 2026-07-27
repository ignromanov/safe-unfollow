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
 * AdSense ad slot.
 *
 * Renders nothing (null, no reserved space) unless ALL conditions hold:
 * - `VITE_ADSENSE_CLIENT` and the placement `slot` are configured
 * - the current route is not `/sample`
 *
 * Consent for EEA/UK/CH visitors is handled by Google's certified CMP on top
 * of the ad script — there is no client-side geo-gate.
 *
 * When eligible it renders a space-reserving container with the `<ins>`
 * element, lazily loads the AdSense script, and requests a fill. See
 * {@link AdSlotFormat} for how each format handles that reserved space.
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
  // the runtime cookie and route.
  const [mounted, setMounted] = useState(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const eligible = Boolean(client) && Boolean(slot) && !isSampleRoute();

  useEffect(() => {
    if (!mounted || !eligible || pushedRef.current || !client) return;
    pushedRef.current = true;
    analytics.adSlotRendered(name);
    pushAdSlot(client);
  }, [mounted, eligible, client, name]);

  if (!mounted || !eligible || !client || !slot) {
    return null;
  }

  const isMultiplex = format === 'multiplex';

  return (
    <div
      className={cn('w-full flex justify-center', !isMultiplex && 'overflow-hidden', className)}
      style={{ minHeight }}
      data-ad-name={name}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', ...(isMultiplex ? {} : { height: minHeight }) }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={isMultiplex ? 'autorelaxed' : 'auto'}
        {...(isMultiplex ? {} : { 'data-full-width-responsive': 'true' })}
      />
    </div>
  );
}
