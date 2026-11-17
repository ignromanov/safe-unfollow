import { useEffect, useState } from 'react';

/**
 * How far up the viewport an AdSense bottom anchor reaches, in px; 0 when there is none.
 *
 * Auto ads put the anchor at the bottom of a phone screen, fixed, at the maximum z-index.
 * Anything fixed at bottom: 0 is then painted under it and cannot be tapped, and drawing over
 * an ad is not ours to do (AdSense forbids overlapping ads). So a bottom-fixed surface sits
 * above it. A top anchor (bottom far from the viewport's) and a dismissed one
 * (`data-anchor-status="dismissed"`) count as nothing.
 */
export function bottomAnchorInset(win: Window = window): number {
  const viewport = win.innerHeight;
  let inset = 0;
  for (const ad of win.document.querySelectorAll<HTMLElement>(
    'ins.adsbygoogle[data-anchor-status]'
  )) {
    if (ad.getAttribute('data-anchor-status') === 'dismissed') continue;
    if (win.getComputedStyle(ad).position !== 'fixed') continue;
    const rect = ad.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom >= viewport - 1) {
      inset = Math.max(inset, Math.round(viewport - rect.top));
    }
  }
  return inset;
}

/** bottomAnchorInset, kept current while the anchor loads, resizes or is closed. */
export function useBottomAnchorInset(): number {
  const [inset, setInset] = useState(() => bottomAnchorInset());

  useEffect(() => {
    const read = () => setInset(bottomAnchorInset());
    read();
    // The anchor is inserted and collapsed by AdSense's own script, which only touches body.
    const observer = new MutationObserver(read);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'data-anchor-status'],
    });
    window.addEventListener('resize', read);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  return inset;
}
