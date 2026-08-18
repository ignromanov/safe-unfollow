import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Whether the referenced element currently intersects the viewport, observed
 * at threshold 0 (any pixel visible counts as in view). The seam Wizard.tsx
 * uses to decide whether its bottom bar shows the normal step nav or takes
 * over as the primary action once the in-flow CTA scrolls out of sight.
 *
 * Defaults to `true` (in view) when `IntersectionObserver` is unavailable —
 * the wizard is prerendered and SSG has no observer until React hydrates, so
 * this default keeps the bar in its normal state rather than flashing the
 * scrolled-out layout before hydration can measure anything.
 */
export function useIsElementInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return inView;
}
