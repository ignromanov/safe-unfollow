import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdSlot } from '@/components/ads/AdSlot';

const loadAdsenseScript = vi.fn();
const pushAdSlot = vi.fn();
const adSlotRendered = vi.fn();

vi.mock('@/lib/ads/loader', () => ({
  loadAdsenseScript: (client: string) => loadAdsenseScript(client),
  pushAdSlot: () => pushAdSlot(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { adSlotRendered: (slot: string) => adSlotRendered(slot) },
}));

const CLIENT = 'ca-pub-5976295812261948';
const SLOT = '1234567890';

function allowAds(): void {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => 'su_ads=1',
  });
}

function blockAds(): void {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => 'su_ads=0',
  });
}

describe('AdSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    blockAds();
    vi.stubEnv('VITE_ADSENSE_CLIENT', CLIENT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when the client env is missing', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', '');
    allowAds();
    const { container } = render(<AdSlot name="home" slot={SLOT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the slot id is missing', () => {
    allowAds();
    const { container } = render(<AdSlot name="home" slot={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when ads are geo-blocked', () => {
    blockAds();
    const { container } = render(<AdSlot name="home" slot={SLOT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on the /sample route', () => {
    allowAds();
    window.history.pushState({}, '', '/sample');
    const { container } = render(<AdSlot name="home" slot={SLOT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a fixed-height container with the ins element when eligible', () => {
    allowAds();
    const { container } = render(<AdSlot name="home" slot={SLOT} minHeight={250} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.minHeight).toBe('250px');

    const ins = wrapper.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins).not.toBeNull();
    expect(ins.getAttribute('data-ad-client')).toBe(CLIENT);
    expect(ins.getAttribute('data-ad-slot')).toBe(SLOT);
  });

  it('loads the script, tracks the impression and pushes the slot once', () => {
    allowAds();
    const { rerender } = render(<AdSlot name="results" slot={SLOT} />);
    rerender(<AdSlot name="results" slot={SLOT} />);

    expect(loadAdsenseScript).toHaveBeenCalledTimes(1);
    expect(loadAdsenseScript).toHaveBeenCalledWith(CLIENT);
    expect(adSlotRendered).toHaveBeenCalledWith('results');
    expect(pushAdSlot).toHaveBeenCalledTimes(1);
  });
});
