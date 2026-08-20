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
    const withAdEnv = (fn: () => void) => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      vi.stubEnv('VITE_ADSENSE_SLOT_HOME', '111');
      try {
        fn();
      } finally {
        vi.unstubAllEnvs();
      }
    };

    it('should render no ads when the slot env vars are unset', () => {
      const { container } = render(<HomePage />);

      expect(container.querySelectorAll('[data-ad-name]')).toHaveLength(0);
    });

    it('should place the in-content ad between HowTo and FAQ', () => {
      withAdEnv(() => {
        render(<HomePage />);

        const ad = document.querySelector('[data-ad-name="home"]') as HTMLElement;
        expect(ad).not.toBeNull();
        expect(
          screen.getByTestId('how-to-section').compareDocumentPosition(ad) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
          screen.getByTestId('faq-section').compareDocumentPosition(ad) &
            Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy();
      });
    });

    it('should carry exactly one ad unit, and nothing below the footer CTA', () => {
      // The end-of-page multiplex was removed after measurement: 725 impressions
      // returned $0.03 at 2.49% viewability. Asserting the count rather than the
      // absence of one name means a second unit cannot reappear here unnoticed.
      withAdEnv(() => {
        const { container } = render(<HomePage />);

        const ads = container.querySelectorAll('[data-ad-name]');
        expect(ads).toHaveLength(1);
        expect(ads[0]?.getAttribute('data-ad-name')).toBe('home');
        expect(
          screen.getByTestId('footer-cta').compareDocumentPosition(ads[0] as HTMLElement) &
            Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy();
      });
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
