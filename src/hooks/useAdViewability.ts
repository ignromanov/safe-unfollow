import { useEffect, useRef } from 'react';

import type { RefObject } from 'react';

/** MRC display standard: half the pixels... */
const MRC_VISIBLE_RATIO = 0.5;
/** ...for one continuous second. */
export const MRC_DWELL_MS = 1000;

/**
 * IntersectionObserver rounds ratios, so a threshold crossing can be reported
 * fractionally under the value that triggered it.
 */
const RATIO_EPSILON = 0.001;

/**
 * Thresholds to subscribe with — dense on purpose.
 *
 * A single threshold cannot work here. The ratio we compare against is not a
 * constant: it depends on the element's current height, and an ad unit's height
 * changes when the ad fills. `threshold` is fixed at construction and cannot be
 * changed afterwards, so instead of baking one comparison target in, we ask for
 * callbacks all the way along the range and decide viewability ourselves on each.
 */
const THRESHOLDS: readonly number[] = Array.from({ length: 101 }, (_, index) => index / 100);

/**
 * Whether this entry satisfies the MRC viewable-impression condition.
 *
 * Evaluated per callback from the entry's own geometry, never cached. Two reasons
 * it must be fresh:
 *
 * `intersectionRatio` is a fraction of the *element*, so an element taller than
 * the viewport can never reach 0.5 — its ceiling is `rootHeight / elementHeight`,
 * reached only when the viewport sits entirely inside the ad. Such elements need
 * the "ad covers half the viewport" fallback, which is the spirit of the MRC
 * large-ad allowance.
 *
 * And an element can *become* that after the observer is already subscribed: the
 * `multiplex` format reserves a small height up front and grows past it as its
 * tile grid fills. Measuring once at subscribe time would leave that unit
 * comparing against a stale 0.5 forever, and its impression would never be
 * counted at all — a silent undercount, which is the more dangerous direction.
 */
function isViewable(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;

  const elementHeight = entry.boundingClientRect.height;
  const rootHeight = entry.rootBounds?.height ?? window.innerHeight;
  if (elementHeight <= 0 || rootHeight <= 0) return false;

  const target =
    elementHeight <= rootHeight
      ? MRC_VISIBLE_RATIO
      : (rootHeight * MRC_VISIBLE_RATIO) / elementHeight;

  return entry.intersectionRatio >= target - RATIO_EPSILON;
}

/**
 * Calls `onViewable` once, when the referenced element first satisfies the MRC
 * viewable-impression standard for display ads.
 *
 * Deliberately silent when `IntersectionObserver` is missing: without it there
 * is no way to measure dwell, and emitting anyway would recreate the mount-time
 * count this gate exists to replace.
 *
 * Do **not** add a `firedRef` guard at the top of the observer callback.
 * `disconnect()` is synchronous and stops all further notifications for that
 * observer, including already-queued records, so such a guard is unreachable in
 * every real browser — and it costs the test suite its ability to prove that
 * `disconnect()` is what stops re-firing. If a test double appears to need it,
 * the double is what is wrong.
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

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[entries.length - 1];
        if (entry === undefined || !isViewable(entry)) {
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
      { threshold: [...THRESHOLDS] }
    );
    observer.observe(element);

    return () => {
      cancel();
      observer.disconnect();
    };
  }, [ref, enabled]);
}
