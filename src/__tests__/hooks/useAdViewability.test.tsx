import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MRC_DWELL_MS, useAdViewability } from '@/hooks/useAdViewability';

let observed: Array<{ element: Element; callback: IntersectionObserverCallback }>;
let observerOptions: IntersectionObserverInit | undefined;
let disconnects: number;

function emit(ratio: number, isIntersecting = ratio > 0): void {
  act(() => {
    for (const { element, callback } of observed) {
      callback(
        [
          {
            isIntersecting,
            intersectionRatio: ratio,
            target: element,
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
        constructor(
          private callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit
        ) {
          observerOptions = options;
        }
        observe(element: Element): void {
          observed.push({ element, callback: this.callback });
        }
        unobserve(): void {}
        disconnect(): void {
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
    emit(0.1, false);
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

  it('lowers the threshold for a unit taller than the viewport', () => {
    // A multiplex grid can exceed the viewport, and its ratio then can never
    // reach 0.5 — the impression would never be counted at all.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 1560,
      width: 320,
    } as DOMRect);

    render(<Harness onViewable={vi.fn()} height={1560} />);

    // Half the 780px viewport over a 1560px element.
    expect(observerOptions?.threshold).toEqual([0.25]);
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
