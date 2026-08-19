import { useCallback, useEffect, useState } from 'react';

/**
 * Whether the currently attached element intersects the viewport, observed
 * at threshold 0 (any pixel visible counts as in view). Returns a callback
 * ref rather than accepting a `RefObject`: the wizard route reuses one
 * `Wizard` element across every step (`routes.tsx`), so a `RefObject`
 * passed in from the caller keeps the same identity across step changes —
 * an effect keyed on that object's identity (`useEffect(..., [ref])`) would
 * only ever run once, on mount, and would keep observing whatever node was
 * attached at that first render even after it detaches from the DOM.
 *
 * A callback ref sidesteps that: React invokes it with the new node on
 * attach and with `null` on detach, and both calls flow into state here, so
 * the observing effect re-runs exactly when the observed element changes —
 * including across an unmount/remount pair, like the reader leaving wizard
 * step 1 and coming back to it.
 *
 * Defaults to `true` (in view) whenever no element is attached yet, or one
 * has just attached and hasn't been measured — the wizard is prerendered
 * and SSG has no observer until React hydrates, so this default keeps the
 * bar in its normal state rather than flashing the scrolled-out layout
 * before hydration (or a fresh attach) can measure anything.
 */
export function useIsElementInView<T extends HTMLElement>(): [boolean, (node: T | null) => void] {
  const [inView, setInView] = useState(true);
  const [element, setElement] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    setElement(node);
    if (node) setInView(true);
  }, []);

  useEffect(() => {
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
  }, [element]);

  return [inView, ref];
}
