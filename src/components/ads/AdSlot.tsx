import { useEffect, useRef, useState, type ReactElement } from 'react';

import { areAdsAllowed, isSampleRoute } from '@/lib/ads/geo';
import { loadAdsenseScript, pushAdSlot } from '@/lib/ads/loader';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export interface AdSlotProps {
  /** Analytics/debug name for this placement (e.g. "home", "results"). */
  name: string;
  /** AdSense ad unit slot ID (from env). When empty, the slot renders nothing. */
  slot: string | undefined;
  /**
   * Reserved height in px for the ad container. Kept fixed so the slot
   * contributes zero CLS whether or not an ad fills it.
   */
  minHeight?: number;
  className?: string;
}

/**
 * AdSense ad slot.
 *
 * Renders nothing (null, no reserved space) unless ALL conditions hold:
 * - `VITE_ADSENSE_CLIENT` and the placement `slot` are configured
 * - the visitor is geo-allowed (see lib/ads/geo)
 * - the current route is not `/sample`
 *
 * When eligible it renders a fixed-height container with the `<ins>` element,
 * lazily loads the AdSense script, and requests a fill — keeping CLS at 0.
 */
export function AdSlot({
  name,
  slot,
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

  const eligible = Boolean(client) && Boolean(slot) && !isSampleRoute() && areAdsAllowed();

  useEffect(() => {
    if (!mounted || !eligible || pushedRef.current || !client) return;
    pushedRef.current = true;
    loadAdsenseScript(client);
    analytics.adSlotRendered(name);
    pushAdSlot();
  }, [mounted, eligible, client, name]);

  if (!mounted || !eligible || !client || !slot) {
    return null;
  }

  return (
    <div
      className={cn('w-full flex justify-center overflow-hidden', className)}
      style={{ minHeight }}
      data-ad-name={name}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: minHeight }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
