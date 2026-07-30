import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MRC_DWELL_MS, useAdViewability } from '@/hooks/useAdViewability';

let observed: Array<{
  element: Element;
  callback: IntersectionObserverCallback;
  isActive: () => boolean;
}>;
let observerOptions: IntersectionObserverInit | undefined;
let disconnects: number;

/**
 * Simulate one observer callback.
 *
 * `elementHeight` is a parameter because the hook decides viewability from the
 * entry's own geometry — so "the unit grew after we subscribed" is expressed by
 * emitting a taller box, which is exactly the case that must not silently stop
 * counting.
 */
function emit(
  ratio: number,
  {
    isIntersecting = ratio > 0,
    elementHeight = 280,
    rootHeight = 780,
  }: { isIntersecting?: boolean; elementHeight?: number; rootHeight?: number } = {}
): void {
  act(() => {
    for (const { element, callback, isActive } of observed) {
      // A disconnected observer delivers nothing, so the double must not either.
      if (!isActive()) continue;
      callback(
        [
          {
            isIntersecting,
            intersectionRatio: ratio,
            target: element,
            boundingClientRect: { height: elementHeight } as DOMRectReadOnly,
            rootBounds: { height: rootHeight } as DOMRectReadOnly,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    }
  });
}

function Harness({
  onViewable,
  enabled = true,
  height = 280,
}: {
  onViewable: () => void;
  enabled?: boolean;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAdViewability(ref, enabled, onViewable);
  return <div ref={ref} data-testid="slot" style={{ height }} />;
}

describe('useAdViewability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observed = [];
    observerOptions = undefined;
    disconnects = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private connected = true;
        constructor(
          private callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit
        ) {
          observerOptions = options;
        }
        observe(element: Element): void {
          // `isActive` is what makes this double honest: the real disconnect()
          // is synchronous and stops all further notifications, so a double that
          // keeps delivering would let a missing disconnect() pass unnoticed.
          observed.push({ element, callback: this.callback, isActive: () => this.connected });
        }
        unobserve(): void {
          this.connected = false;
        }
        disconnect(): void {
          this.connected = false;
          disconnects += 1;
        }
      }
    );
    // jsdom reports 0×0 for everything; give the element a real box.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 280,
      width: 320,
    } as DOMRect);
    vi.stubGlobal('innerHeight', 780);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits nothing before the dwell elapses', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.6);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS - 1));

    expect(onViewable).not.toHaveBeenCalled();
  });

  it('emits once the slot has held 50% visibility for a full second', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.6);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).toHaveBeenCalledTimes(1);
  });

  it('emits nothing when the slot leaves before the second is up', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.6);
    act(() => vi.advanceTimersByTime(600));
    emit(0.1, { isIntersecting: false });
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).not.toHaveBeenCalled();
  });

  it('emits nothing while it is visible but under half', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.3);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).not.toHaveBeenCalled();
  });

  it('emits at most once per mount and stops observing', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.6);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));
    emit(0.9);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).toHaveBeenCalledTimes(1);
    expect(disconnects).toBeGreaterThan(0);
  });

  it('does not observe while disabled', () => {
    render(<Harness onViewable={vi.fn()} enabled={false} />);

    expect(observed).toHaveLength(0);
  });

  it('subscribes with a dense threshold list, because the comparison target is not constant', () => {
    // `threshold` is fixed at construction. Since the ratio we compare against
    // depends on the element's current height, a single baked value cannot work
    // — we need callbacks along the range and decide viewability ourselves.
    render(<Harness onViewable={vi.fn()} />);

    expect(Array.isArray(observerOptions?.threshold)).toBe(true);
    expect((observerOptions?.threshold as number[]).length).toBe(101);
  });

  it('counts a unit that grew taller than the viewport after subscribing', () => {
    // The regression guard for the real multiplex lifecycle: reserved height at
    // subscribe time, tall once the tile grid fills. A target measured once at
    // subscribe would stay at 0.5 and this impression would never be counted —
    // a silent undercount, which is the more dangerous direction.
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    // Half the 780px viewport over a 1560px element is 0.25 — viewable.
    emit(0.25, { elementHeight: 1560 });
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).toHaveBeenCalledTimes(1);
  });

  it('still demands half the element when the element fits the viewport', () => {
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    // 0.25 is enough only for an oversized element; at 280px the bar is 0.5.
    emit(0.25, { elementHeight: 280 });
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).not.toHaveBeenCalled();
  });

  it('stops firing because the observer was disconnected, not because of a flag', () => {
    // With the double honouring disconnect(), this fails if disconnect() is
    // removed from the fire path — which a `firedRef` guard would have masked.
    const onViewable = vi.fn();
    render(<Harness onViewable={onViewable} />);

    emit(0.6);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));
    expect(disconnects).toBeGreaterThan(0);

    emit(0.9);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS));

    expect(onViewable).toHaveBeenCalledTimes(1);
  });

  it('emits nothing when IntersectionObserver is unavailable', () => {
    // Without a gate there is no honest dwell measurement, and firing anyway
    // would reintroduce exactly the mount-time count this replaces.
    vi.stubGlobal('IntersectionObserver', undefined);
    const onViewable = vi.fn();

    render(<Harness onViewable={onViewable} />);
    act(() => vi.advanceTimersByTime(MRC_DWELL_MS * 3));

    expect(onViewable).not.toHaveBeenCalled();
  });
});
