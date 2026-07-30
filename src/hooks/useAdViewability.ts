import { useEffect, useRef } from 'react';

import type { RefObject } from 'react';

/** MRC display standard: half the pixels... */
export const MRC_VISIBLE_RATIO = 0.5;
/** ...for one continuous second. */
export const MRC_DWELL_MS = 1000;

/**
 * IntersectionObserver rounds ratios, so a threshold crossing can be reported
 * fractionally under the value that triggered it.
 */
const RATIO_EPSILON = 0.001;

/**
 * The ratio that counts as "half visible" for this particular element.
 *
 * `intersectionRatio` is a fraction of the *element*, not of the viewport, so an
 * element taller than the viewport can never reach 0.5 — a multiplex unit sizes
 * its own rows and does exactly that. For those, require that the ad cover half
 * the viewport instead, which is the spirit of the MRC large-ad allowance.
 */
function effectiveRatio(element: HTMLElement): number {
  const { height } = element.getBoundingClientRect();
  const viewport = window.innerHeight;
  if (height <= 0 || viewport <= 0) return MRC_VISIBLE_RATIO;
  return Math.min(MRC_VISIBLE_RATIO, (viewport * MRC_VISIBLE_RATIO) / height);
}

/**
 * Calls `onViewable` once, when the referenced element first satisfies the MRC
 * viewable-impression standard for display ads.
 *
 * Deliberately silent when `IntersectionObserver` is missing: without it there
 * is no way to measure dwell, and emitting anyway would recreate the mount-time
 * count this gate exists to replace.
 */
export function useAdViewability(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onViewable: () => void
): void {
  const firedRef = useRef(false);
  const callbackRef = useRef(onViewable);
  callbackRef.current = onViewable;

  useEffect(() => {
    if (!enabled || firedRef.current) return;

    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let timer: number | undefined;
    const cancel = (): void => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const ratio = effectiveRatio(element);
    const observer = new IntersectionObserver(
      entries => {
        // disconnect() stops future callbacks in real browsers, but is not
        // guaranteed to be synchronous everywhere — guard explicitly so a
        // late-arriving entry can never start a second dwell timer.
        if (firedRef.current) return;

        const entry = entries[entries.length - 1];
        const isVisibleEnough =
          entry?.isIntersecting === true && entry.intersectionRatio >= ratio - RATIO_EPSILON;

        if (!isVisibleEnough) {
          cancel();
          return;
        }
        if (timer !== undefined) return;

        timer = window.setTimeout(() => {
          timer = undefined;
          firedRef.current = true;
          callbackRef.current();
          observer.disconnect();
        }, MRC_DWELL_MS);
      },
      { threshold: [ratio] }
    );
    observer.observe(element);

    return () => {
      cancel();
      observer.disconnect();
    };
  }, [ref, enabled]);
}
