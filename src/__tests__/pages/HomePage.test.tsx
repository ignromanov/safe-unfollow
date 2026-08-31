import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component as HomePage } from '@/pages/HomePage';
import { useAppStore } from '@/lib/store';
import type { FileMetadata } from '@/core/types';

// Wraps (not replaces) the real useHasResults so its SSR-safe behavior stays
// real while call count stays observable — hasResults must be sourced from
// this shared hook, not recomputed locally from useInstagramData.
vi.mock('@/hooks/useHasResults', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/useHasResults')>();
  return { ...actual, useHasResults: vi.fn(actual.useHasResults) };
});

const FILE: FileMetadata = {
  name: 'test.zip',
  size: 1,
  uploadDate: new Date('2026-01-01'),
  fileHash: 'abc123',
  accountCount: 100,
};

// Mock child components
vi.mock('@/components/Hero', () => ({
  Hero: ({ hasData }: { hasData?: boolean }) => (
    <div data-testid="hero">
      <span data-testid="has-data">{String(hasData)}</span>
    </div>
  ),
}));

vi.mock('@/components/HowToSection', () => ({
  HowToSection: () => <div data-testid="how-to-section" />,
}));

vi.mock('@/components/FAQSection', () => ({
  FAQSection: () => <div data-testid="faq-section">FAQ Section</div>,
}));

// Rendered unconditionally, unlike the real AdSlot, which returns null unless
// both VITE_ADSENSE_CLIENT and its slot id are set. The landing page's no-ads
// guard must fail when a unit comes back, not when someone forgets to stub an
// env var — so the mock ignores configuration entirely.
vi.mock('@/components/ads/AdSlot', () => ({
  AdSlot: ({ name }: { name: string }) => <div data-ad-name={name} />,
}));

vi.mock('@/components/FooterCTA', () => ({
  FooterCTA: () => <div data-testid="footer-cta" />,
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // hasResults (Hero's hasData) is sourced from useAppStore via useHasResults,
    // not from useInstagramData — reset the real store directly.
    useAppStore.setState({ uploadStatus: 'idle', fileMetadata: null });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<HomePage />);

      expect(screen.getByTestId('hero')).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      render(<HomePage />);

      expect(screen.getByTestId('hero')).toBeInTheDocument();
      expect(screen.getByTestId('how-to-section')).toBeInTheDocument();
      expect(screen.getByTestId('faq-section')).toBeInTheDocument();
      expect(screen.getByTestId('footer-cta')).toBeInTheDocument();
    });

    it('should pass hasData as false when no upload data', () => {
      render(<HomePage />);

      expect(screen.getByTestId('has-data')).toHaveTextContent('false');
    });

    it('should pass hasData as true when upload is successful', () => {
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      render(<HomePage />);

      expect(screen.getByTestId('has-data')).toHaveTextContent('true');
    });
  });

  describe('hydration parity', () => {
    it('sources hasData from the shared useHasResults hook, not a page-local computation', async () => {
      // The regression this guards against: HomePage used to derive hasResults
      // itself from useInstagramData(), independently of Layout's useHasResults.
      // That duplication is what let the two fall out of sync — Layout gates on
      // hydration, HomePage did not. Asserting the shared hook is actually
      // invoked (not just that some boolean happens to match) is what catches
      // a page-local computation creeping back in.
      const { useHasResults } = await import('@/hooks/useHasResults');

      render(<HomePage />);

      expect(useHasResults).toHaveBeenCalled();
    });

    it('renders the no-data CTA set when the store already has data but the hook has not updated yet', () => {
      // renderToString always invokes useSyncExternalStore's getServerSnapshot,
      // which is exactly what happens on a returning visitor's first render:
      // zustand's persist middleware rehydrates the store synchronously from
      // localStorage before hydration runs, so the store already says "success"
      // while the prerendered HTML was built with no data. HomePage must defer
      // to useHasResults (which forces false here) instead of computing
      // hasResults itself, or this disagrees with the prerendered HTML and
      // React throws #423/#425, discarding the prerendered DOM.
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      const html = renderToString(<HomePage />);

      expect(html).toContain('has-data">false');
    });
  });

  describe('wizard prefetch', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('schedules a WizardPage prefetch via requestIdleCallback when available', () => {
      const requestIdleCallbackSpy = vi.fn(() => 1);
      const cancelIdleCallbackSpy = vi.fn();
      vi.stubGlobal('requestIdleCallback', requestIdleCallbackSpy);
      vi.stubGlobal('cancelIdleCallback', cancelIdleCallbackSpy);

      const { unmount } = render(<HomePage />);

      expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 3000,
      });

      unmount();

      expect(cancelIdleCallbackSpy).toHaveBeenCalledWith(1);
    });

    it('falls back to a 2s timeout when requestIdleCallback is unavailable', () => {
      // jsdom has no requestIdleCallback by default, so this exercises the
      // real fallback branch rather than a simulated one.
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = render(<HomePage />);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('ad placements', () => {
    // The landing page carries no ad unit, and the choice is not about this
    // unit's own earnings. `adsbygoogle.js` is injected once per SPA session by
    // whichever AdSlot first nears the viewport (ads/loader.ts, AdSlot.tsx), and
    // from then on Google's Auto ads — the full-screen vignette included — may
    // render on any route, including `/upload`, which declares no slot. So a
    // modest banner here is not on the menu: igniting the script on `/` opts the
    // landing page into the whole auto suite before a visitor has decided to
    // trust the tool.
    //
    // What was given up is real: this unit reached 0.52% of `/` visits (35 of
    // 6,684 in a week) where the results units reach 72.4%, and placing it where
    // it would serve projected roughly +$20-30/month against an August AdSense
    // total of $10.33. It was declined because the gain is measurable within a
    // week and the cost — export-sale conversions on a rail that netted ~$11 in
    // its last seven days, n = 2 — is not measurable at all.
    // See .conclave/.claude/analytics/2026-08-31-adsense-ignition-and-the-vignette-date.md
    //
    // The `home_footer` multiplex went the same way earlier, on its own
    // measurement: 725 impressions, $0.03, 2.49% viewability. Asserting the
    // count rather than the absence of a name means neither can reappear here
    // unnoticed. AdSlot is mocked above so this holds regardless of env.
    it('should mount no AdSlot at all', () => {
      const { container } = render(<HomePage />);

      expect(container.querySelectorAll('[data-ad-name]')).toHaveLength(0);
    });
  });

  describe('sections animation', () => {
    it('should wrap sections in animated container', () => {
      const { container } = render(<HomePage />);

      const animatedDiv = container.querySelector('.animate-in.fade-in');
      expect(animatedDiv).toBeInTheDocument();
      expect(animatedDiv).toContainElement(screen.getByTestId('how-to-section'));
      expect(animatedDiv).toContainElement(screen.getByTestId('faq-section'));
      expect(animatedDiv).toContainElement(screen.getByTestId('footer-cta'));
    });
  });
});
