import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdSlot } from '@/components/ads/AdSlot';

const pushAdSlot = vi.fn();
const adSlotRendered = vi.fn();

vi.mock('@/lib/ads/loader', () => ({
  pushAdSlot: () => pushAdSlot(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { adSlotRendered: (slot: string) => adSlotRendered(slot) },
}));

const CLIENT = 'ca-pub-5976295812261948';
const SLOT = '1234567890';

describe('AdSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    vi.stubEnv('VITE_ADSENSE_CLIENT', CLIENT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

    const ins = container.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins.getAttribute('data-ad-format')).toBe('auto');
    expect(ins.getAttribute('data-full-width-responsive')).toBe('true');
    // Fixed height keeps a display unit at zero CLS.
    expect(ins.style.height).toBe('250px');
  });

  it('renders a multiplex unit with the autorelaxed format', () => {
    const { container } = render(<AdSlot name="home_footer" slot={SLOT} format="multiplex" />);

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
    rerender(<AdSlot name="results" slot={SLOT} />);

    expect(adSlotRendered).toHaveBeenCalledTimes(1);
    expect(adSlotRendered).toHaveBeenCalledWith('results');
    expect(pushAdSlot).toHaveBeenCalledTimes(1);
  });
});
