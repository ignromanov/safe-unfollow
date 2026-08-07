import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdSlot } from '@/components/ads/AdSlot';

const pushAdSlot = vi.fn();
const adSlotViewable = vi.fn();

vi.mock('@/lib/ads/loader', () => ({
  pushAdSlot: () => pushAdSlot(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { adSlotViewable: (slot: string) => adSlotViewable(slot) },
}));

const CLIENT = 'ca-pub-5976295812261948';
const SLOT = '1234567890';

/** Observed elements, in observe() order, with their observer callbacks. */
let observed: Array<{ element: Element; callback: IntersectionObserverCallback }>;
let observerOptions: IntersectionObserverInit | undefined;
let disconnects: number;

/** Simulate the observed slot entering the (margin-expanded) viewport. */
function scrollIntoView(): void {
  act(() => {
    for (const { element, callback } of observed) {
      callback(
        [{ isIntersecting: true, target: element } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    }
  });
}

/** Hold the slot half-visible long enough to satisfy the MRC dwell. */
function dwell(): void {
  act(() => {
    for (const { element, callback } of observed) {
      callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            // `isViewable` measures real geometry: it divides rootHeight by
            // elementHeight and returns false for a zero-height element, so an
            // entry without a boundingClientRect can never count as viewable.
            boundingClientRect: { height: 280 } as DOMRectReadOnly,
            target: element,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    }
  });
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

describe('AdSlot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    vi.stubEnv('VITE_ADSENSE_CLIENT', CLIENT);

    observed = [];
    observerOptions = undefined;
    disconnects = 0;
    // The shared browser mock is a no-op stub; this one is controllable.
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
          // A disconnected observer delivers nothing further, including
          // already-queued records. Without this, `dwell()` keeps invoking a
          // callback the hook has already shut down — and `useAdViewability`
          // deliberately has no callback-level `firedRef` guard, precisely so a
          // test can prove that `disconnect()` is what stops the re-fire.
          // Filter, not splice: cleanup disconnects a second time on unmount.
          observed = observed.filter(entry => entry.callback !== this.callback);
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders nothing when the client env is missing', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', '');
    const { container } = render(<AdSlot name="home" slot={SLOT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the slot id is missing', () => {
    const { container } = render(<AdSlot name="home" slot={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on the /sample route', () => {
    window.history.pushState({}, '', '/sample');
    const { container } = render(<AdSlot name="home" slot={SLOT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a fixed-height container with the ins element when eligible', () => {
    const { container } = render(<AdSlot name="home" slot={SLOT} minHeight={250} />);
    scrollIntoView();

    // The label sits in the outer `[data-ad-name]` wrapper; the reserved
    // height lives on its inner div, which the viewability gate measures.
    const wrapper = container.querySelector('[data-ad-name] > div') as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.minHeight).toBe('250px');

    const ins = wrapper.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins).not.toBeNull();
    expect(ins.getAttribute('data-ad-client')).toBe(CLIENT);
    expect(ins.getAttribute('data-ad-slot')).toBe(SLOT);
  });

  it('renders a responsive display unit by default', () => {
    const { container } = render(<AdSlot name="home" slot={SLOT} minHeight={250} />);
    scrollIntoView();

    const ins = container.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins.getAttribute('data-ad-format')).toBe('auto');
    expect(ins.getAttribute('data-full-width-responsive')).toBe('true');
    // Fixed height keeps a display unit at zero CLS.
    expect(ins.style.height).toBe('250px');
  });

  it('renders a multiplex unit with the autorelaxed format', () => {
    const { container } = render(<AdSlot name="home_footer" slot={SLOT} format="multiplex" />);
    scrollIntoView();

    const ins = container.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins.getAttribute('data-ad-format')).toBe('autorelaxed');
    // Multiplex sizes its own grid: a fixed height would clip the tiles, and
    // full-width-responsive is not a valid attribute for this format.
    expect(ins.style.height).toBe('');
    expect(ins.getAttribute('data-full-width-responsive')).toBeNull();
  });

  it('reserves space for a multiplex unit without clipping its grid', () => {
    const { container } = render(
      <AdSlot name="home_footer" slot={SLOT} format="multiplex" minHeight={300} />
    );

    const wrapper = container.querySelector('[data-ad-name] > div') as HTMLElement;
    // Space is still reserved up front...
    expect(wrapper.style.minHeight).toBe('300px');
    // ...but the grid may grow past it, so it must not be clipped.
    expect(wrapper.className).not.toContain('overflow-hidden');
  });

  describe('width', () => {
    it('caps the box at the widest creative served, so no unfillable band is promised', () => {
      const { container } = render(<AdSlot name="results" slot={SLOT} />);

      const box = container.querySelector('[data-ad-name]') as HTMLElement;
      expect(box.style.maxWidth).toBe('1200px');
      // A capped box narrower than its column has to be centred, or it reads as
      // a layout bug rather than as an ad that happens not to be full-bleed.
      expect(box.className).toContain('mx-auto');
    });

    it('centres a creative that comes back narrower than the box', () => {
      const { container } = render(<AdSlot name="results" slot={SLOT} />);
      scrollIntoView();

      // AdSense injects its own iframe inside the `ins`, sized to whatever
      // creative it picked. Left-aligned by default — which is exactly what a
      // full-width column made visible.
      const ins = container.querySelector('ins.adsbygoogle') as HTMLElement;
      expect(ins.style.textAlign).toBe('center');
    });
  });

  describe('impression accounting', () => {
    it('requests the fill without claiming an impression', () => {
      render(<AdSlot name="results" slot={SLOT} />);
      scrollIntoView();

      expect(pushAdSlot).toHaveBeenCalledTimes(1);
      // Approaching is 400px of lead time — the reader has not seen anything yet.
      expect(adSlotViewable).not.toHaveBeenCalled();
    });

    it('claims the impression only after the MRC dwell', () => {
      render(<AdSlot name="results" slot={SLOT} />);
      scrollIntoView();

      dwell();

      expect(adSlotViewable).toHaveBeenCalledTimes(1);
      expect(adSlotViewable).toHaveBeenCalledWith('results');
    });

    it('claims it once even if the reader scrolls back and forth', () => {
      const { rerender } = render(<AdSlot name="results" slot={SLOT} />);
      scrollIntoView();
      dwell();
      rerender(<AdSlot name="results" slot={SLOT} />);
      dwell();

      expect(adSlotViewable).toHaveBeenCalledTimes(1);
      expect(pushAdSlot).toHaveBeenCalledTimes(1);
    });
  });

  describe('lazy loading', () => {
    it('reserves space but requests nothing until the slot nears the viewport', () => {
      const { container } = render(<AdSlot name="home" slot={SLOT} minHeight={250} />);

      // Space is reserved from the first paint, so the later fill costs no CLS.
      const wrapper = container.querySelector('[data-ad-name] > div') as HTMLElement;
      expect(wrapper.style.minHeight).toBe('250px');
      // ...but no ad markup, no script, no request.
      expect(wrapper.querySelector('ins.adsbygoogle')).toBeNull();
      expect(pushAdSlot).not.toHaveBeenCalled();
      expect(adSlotViewable).not.toHaveBeenCalled();
    });

    it('observes the container with a lead margin, then stops observing', () => {
      render(<AdSlot name="home" slot={SLOT} />);

      expect(observed).toHaveLength(1);
      expect(observerOptions?.rootMargin).toBe('400px 0px');

      scrollIntoView();
      dwell();
      dwell();
      expect(adSlotViewable).toHaveBeenCalledTimes(1);
    });

    it('mounts the ins element only once the slot is approaching', () => {
      const { container } = render(<AdSlot name="home" slot={SLOT} />);
      expect(container.querySelector('ins.adsbygoogle')).toBeNull();

      scrollIntoView();

      expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
      expect(pushAdSlot).toHaveBeenCalledTimes(1);
    });

    it('ignores non-intersecting callbacks', () => {
      const { container } = render(<AdSlot name="home" slot={SLOT} />);

      act(() => {
        for (const { element, callback } of observed) {
          callback(
            [{ isIntersecting: false, target: element } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        }
      });

      expect(container.querySelector('ins.adsbygoogle')).toBeNull();
      expect(pushAdSlot).not.toHaveBeenCalled();
    });

    it('loads immediately when IntersectionObserver is unavailable', () => {
      vi.stubGlobal('IntersectionObserver', undefined);

      const { container } = render(<AdSlot name="home" slot={SLOT} />);

      expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
      expect(pushAdSlot).toHaveBeenCalledTimes(1);
    });
  });

  it('labels the unit, which the distinguishability policy requires', () => {
    const { container } = render(<AdSlot name="results" slot={SLOT} />);
    scrollIntoView();

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.textContent).toContain('Advertisement');
  });

  it('does not dress the unit up as one of our own cards', () => {
    const { container } = render(<AdSlot name="results" slot={SLOT} />);
    scrollIntoView();

    // Matching our card chrome would make the ad indistinguishable from
    // content, which AdSense forbids outright. Checking only the outer
    // wrapper's className can never catch this — those classes are hardcoded
    // ('w-full' plus whatever the caller passes), so nothing the component
    // itself renders could ever fail that check. Walk the whole subtree
    // instead, since the chrome could land on any element inside it.
    const adRoot = container.querySelector('[data-ad-name]') as HTMLElement;
    const offendingClasses = /bg-gradient|rounded-4xl|bg-card/;
    for (const el of [adRoot, ...adRoot.querySelectorAll('*')]) {
      expect(el.className).not.toMatch(offendingClasses);
    }
  });

  it('pins the label color at the measured AA-passing shades (text-zinc-600 light / text-zinc-400 dark)', () => {
    // Guards against a later "tidy-up" quietly reverting to a shade that
    // fails contrast. Measured against this app's actual --background token
    // (not a card — every placement sits on the page background): zinc-600
    // on light ≈7.51:1, zinc-400 on dark ≈7.92:1. Both clear the 4.5:1 floor
    // small text needs (10px does not qualify for the 3:1 large-text
    // exemption). The prior zinc-400/zinc-500 pair measured ≈2.6:1 / ≈3.7:1
    // and failed AA on both themes.
    const { container } = render(<AdSlot name="results" slot={SLOT} />);
    scrollIntoView();

    const label = container.querySelector('[data-ad-name] > span') as HTMLElement;
    expect(label.className).toContain('text-zinc-600');
    expect(label.className).toContain('dark:text-zinc-400');
  });

  it('associates the label with the ad container for screen readers', () => {
    render(<AdSlot name="results" slot={SLOT} />);
    scrollIntoView();

    // Exercises the actual accessible-name computation, not just the
    // id/attribute pair: an id/aria-labelledby match on a role-less div (role
    // "generic", which is naming-prohibited) would pass an attribute check
    // while still exposing no name to a screen reader. This only passes if
    // the browser-equivalent name resolution actually lands on the element.
    expect(screen.getByRole('group', { name: 'Advertisement' })).toBeInTheDocument();
  });
});
