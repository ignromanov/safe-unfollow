import type { ReactElement } from 'react';

import { AdSlot } from '@/components/ads/AdSlot';

/** The ad unit's own box — AdSlot's default, stated so the reservation below can use it. */
const AD_MIN_HEIGHT = 280;

/**
 * What the slot holds open before the ad mounts: the ad box, its label line
 * and margin (~20px), and the `mt-3` the unit opens with.
 */
const RESERVED_HEIGHT = AD_MIN_HEIGHT + 32;

/**
 * The AdSense unit in the `/upload` body, where the NordVPN block was
 * (operator ruling 2026-10-21: 0 conversions on 509 clicks, $0 ever).
 *
 * `AdSlot` renders nothing until hydration, so on its own it would arrive into
 * the prerendered page and push the tips and the guide down by its full height.
 * This wrapper is what the prerendered HTML carries instead: an empty box of
 * the unit's height. Whether to reserve it depends only on build-time
 * constants, so prerender and hydration agree. With the unit unconfigured
 * nothing is reserved and nothing renders.
 */
export function UploadAdSlot(): ReactElement | null {
  const slot = import.meta.env.VITE_ADSENSE_SLOT_UPLOAD;
  if (!import.meta.env.VITE_ADSENSE_CLIENT || !slot) return null;

  return (
    <div data-upload-ad-reserve="" style={{ minHeight: RESERVED_HEIGHT }}>
      <AdSlot name="upload" slot={slot} minHeight={AD_MIN_HEIGHT} className="mt-3" />
    </div>
  );
}
