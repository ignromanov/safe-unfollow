import { act, render } from '@testing-library/react';
import { useState } from 'react';
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
  const [inView, ref] = useIsElementInView<HTMLDivElement>();
  onValue(inView);
  return <div ref={ref} />;
}

// Mirrors the shape Wizard.tsx actually exercises: one element mounts,
// unmounts, and a *different* element mounts in its place later, all behind
// a stable component (Wizard itself never remounts across wizard steps —
// see routes.tsx). This is the harness that would have caught the bug where
// an effect keyed on a RefObject's identity never re-observed the new node.
function ToggleHarness({ onValue, show }: { onValue: (value: boolean) => void; show: boolean }) {
  const [inView, ref] = useIsElementInView<HTMLDivElement>();
  onValue(inView);
  return <div>{show && <div data-testid="observed" ref={ref} />}</div>;
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

  it('starts in view before anything attaches', () => {
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

  // Critical 2 (final whole-branch review of PR-2): the previous
  // implementation took a RefObject and keyed its effect on the object's
  // identity, which never changes. Wizard.tsx never remounts across step
  // changes, so a stale detached node stayed observed forever and the flag
  // never reflected the element actually on screen. These two cases are the
  // proven failure modes from that review, reproduced at the hook level.
  describe('when the observed element unmounts and a different one attaches', () => {
    it('observes the new element with a fresh observer, not the stale detached one', () => {
      const values: boolean[] = [];
      const { rerender } = render(<ToggleHarness onValue={v => values.push(v)} show={true} />);
      expect(observed).toHaveLength(1);
      const firstElement = observed[0]!.element;

      // Detach: element unmounts (the equivalent of leaving wizard step 1).
      rerender(<ToggleHarness onValue={v => values.push(v)} show={false} />);
      expect(disconnects).toBe(1);

      // Reattach: a brand-new element mounts in its place (returning to step 1).
      rerender(<ToggleHarness onValue={v => values.push(v)} show={true} />);

      expect(observed).toHaveLength(2);
      expect(observed[1]!.element).not.toBe(firstElement);
    });

    it('does not let a stale disconnect report leave the flag stuck false after reattaching', () => {
      const values: boolean[] = [];
      const { rerender } = render(<ToggleHarness onValue={v => values.push(v)} show={true} />);

      // The old element scrolls out (or is torn down) before it unmounts.
      emit(false);
      expect(values[values.length - 1]).toBe(false);

      rerender(<ToggleHarness onValue={v => values.push(v)} show={false} />);
      rerender(<ToggleHarness onValue={v => values.push(v)} show={true} />);

      // A freshly attached element is assumed in view again, exactly like a
      // first mount — it must not inherit the old element's last-known state.
      expect(values[values.length - 1]).toBe(true);

      // And the new observer instance, not a leftover one, is what reports next.
      emit(false);
      expect(values[values.length - 1]).toBe(false);
    });
  });

  it('re-runs the effect when the element instance changes, even without unmounting in between', () => {
    function SwapHarness({ onValue }: { onValue: (v: boolean) => void }) {
      const [key, setKey] = useState(0);
      const [inView, ref] = useIsElementInView<HTMLDivElement>();
      onValue(inView);
      return (
        <div>
          <div key={key} ref={ref} />
          <button onClick={() => setKey(k => k + 1)}>swap</button>
        </div>
      );
    }

    const values: boolean[] = [];
    const { getByRole } = render(<SwapHarness onValue={v => values.push(v)} />);
    expect(observed).toHaveLength(1);

    act(() => {
      getByRole('button').click();
    });

    // The keyed div is a new DOM node, so React detaches the old ref and
    // attaches the new one — a second observer must be created for it.
    expect(observed).toHaveLength(2);
    expect(disconnects).toBe(1);
  });
});
