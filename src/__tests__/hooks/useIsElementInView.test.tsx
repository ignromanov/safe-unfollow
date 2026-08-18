import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsElementInView } from '@/hooks/useIsElementInView';

let observed: Array<{ element: Element; callback: IntersectionObserverCallback }>;
let observerOptions: IntersectionObserverInit | undefined;
let disconnects: number;

function emit(isIntersecting: boolean): void {
  act(() => {
    for (const { element, callback } of observed) {
      callback(
        [{ isIntersecting, target: element } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    }
  });
}

function Harness({ onValue }: { onValue: (value: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useIsElementInView(ref);
  onValue(inView);
  return <div ref={ref} />;
}

describe('useIsElementInView', () => {
  beforeEach(() => {
    observed = [];
    observerOptions = undefined;
    disconnects = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in view before the observer reports anything', () => {
    const values: boolean[] = [];
    render(<Harness onValue={v => values.push(v)} />);

    expect(values[values.length - 1]).toBe(true);
  });

  it('reflects the observer reporting the element left the viewport', () => {
    const values: boolean[] = [];
    render(<Harness onValue={v => values.push(v)} />);

    emit(false);

    expect(values[values.length - 1]).toBe(false);
  });

  it('reflects the observer reporting the element re-entered the viewport', () => {
    const values: boolean[] = [];
    render(<Harness onValue={v => values.push(v)} />);

    emit(false);
    emit(true);

    expect(values[values.length - 1]).toBe(true);
  });

  it('observes at threshold 0', () => {
    render(<Harness onValue={() => {}} />);

    expect(observerOptions?.threshold).toBe(0);
  });

  it('disconnects on unmount', () => {
    const { unmount } = render(<Harness onValue={() => {}} />);
    unmount();

    expect(disconnects).toBeGreaterThan(0);
  });

  it('stays in view when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const values: boolean[] = [];

    render(<Harness onValue={v => values.push(v)} />);

    expect(values[values.length - 1]).toBe(true);
    expect(observed).toHaveLength(0);
  });
});
