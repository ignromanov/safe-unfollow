import { act, render } from '@testing-library/react';
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

describe('AdSlot', () => {
  beforeEach(() => {
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
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

    const wrapper = container.firstChild as HTMLElement;
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

    const wrapper = container.firstChild as HTMLElement;
    // Space is still reserved up front...
    expect(wrapper.style.minHeight).toBe('300px');
    // ...but the grid may grow past it, so it must not be clipped.
    expect(wrapper.className).not.toContain('overflow-hidden');
  });

  it('tracks the impression and pushes the slot once (loader injects the script)', () => {
    const { rerender } = render(<AdSlot name="results" slot={SLOT} />);
    scrollIntoView();
    rerender(<AdSlot name="results" slot={SLOT} />);

    expect(adSlotViewable).toHaveBeenCalledTimes(1);
    expect(adSlotViewable).toHaveBeenCalledWith('results');
    expect(pushAdSlot).toHaveBeenCalledTimes(1);
  });

  describe('lazy loading', () => {
    it('reserves space but requests nothing until the slot nears the viewport', () => {
      const { container } = render(<AdSlot name="home" slot={SLOT} minHeight={250} />);

      // Space is reserved from the first paint, so the later fill costs no CLS.
      const wrapper = container.firstChild as HTMLElement;
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
      expect(disconnects).toBeGreaterThan(0);
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
});
