import { useEffect, useState } from 'react';

/**
 * How far down the viewport an AdSense top anchor reaches, in px; 0 when there is none.
 *
 * Auto ads may place the anchor at the top of a phone screen, fixed, at the maximum z-index.
 * Anything fixed at top: 0 is then painted under it and cannot be clicked, and drawing over an
 * ad is not ours to do (AdSense forbids overlapping ads). So a top-fixed surface sits below it.
 * A bottom anchor (top far from 0) and a dismissed one (`data-anchor-status="dismissed"`) count
 * as nothing.
 */
export function topAnchorInset(doc: Document = document): number {
  let inset = 0;
  for (const ad of doc.querySelectorAll<HTMLElement>('ins.adsbygoogle[data-anchor-status]')) {
    if (ad.getAttribute('data-anchor-status') === 'dismissed') continue;
    if (doc.defaultView?.getComputedStyle(ad).position !== 'fixed') continue;
    const rect = ad.getBoundingClientRect();
    if (rect.height > 0 && rect.top <= 1) inset = Math.max(inset, Math.round(rect.bottom));
  }
  return inset;
}

/** topAnchorInset, kept current while the anchor loads, resizes or is closed. */
export function useTopAnchorInset(): number {
  const [inset, setInset] = useState(topAnchorInset);

  useEffect(() => {
    const read = () => setInset(topAnchorInset());
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
