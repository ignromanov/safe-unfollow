import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

vi.mock('@/hooks/useProExport');

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: {
      ...actual.analytics,
      exportClick: vi.fn(),
      paywallView: vi.fn(),
      exportTriggerViewable: vi.fn(),
    },
  };
});

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import { analytics } from '@/lib/stats';

const mockUseProExport = vi.mocked(useProExport);

const defaultProps = {
  fileHash: 'hash1',
  indices: null,
  totalCount: 42,
  filename: 'my-export',
};

const triggerLabel = resultsEN.export.trigger;

/** Observed elements, in observe() order, with their observer callbacks. */
let observed: Array<{ element: Element; callback: IntersectionObserverCallback }>;
let realObserver: typeof IntersectionObserver;

/**
 * Hold the trigger half-visible long enough to satisfy the MRC dwell.
 *
 * `isViewable` divides rootHeight by the element's own height, so an entry
 * without a real boundingClientRect can never count — a zero-height element
 * returns false before the ratio is ever compared.
 */
function dwell(): void {
  act(() => {
    for (const { element, callback } of observed) {
      callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: { height: 44 } as DOMRectReadOnly,
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

function unlocked(isUnlocked: boolean) {
  mockUseProExport.mockReturnValue({ isEnabled: true, isUnlocked, startCheckout: vi.fn() });
}

describe('ResultsExportControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observed = [];
    realObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(element: Element): void {
        observed.push({ element, callback: this.callback });
      }
      disconnect(): void {
        observed = [];
      }
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = realObserver;
    vi.useRealTimers();
  });

  it('should render nothing when the feature is disabled', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: false,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.queryByRole('button', { name: triggerLabel })).not.toBeInTheDocument();
  });

  it('should render the download button when the feature is enabled', () => {
    unlocked(false);

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.getByRole('button', { name: triggerLabel })).toBeInTheDocument();
  });

  // The trigger opens a paywall rather than downloading a file, so the price
  // belongs on the trigger: a bare download glyph promises a file and delivers
  // an invoice. This asserts the visible text, not an aria-label.
  it('should show the price in the visible trigger text', () => {
    unlocked(false);

    render(<ResultsExportControls {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: triggerLabel });
    expect(trigger).toHaveTextContent('$7');
  });

  // WCAG 2.5.3 Label in Name: the old icon button carried an aria-label of
  // "Export accounts", which would now override visible text reading
  // "Export · $7" — a voice-control user says what they can see and matches
  // nothing. The visible text must BE the accessible name, not shadow it.
  it('should not override the visible label with an aria-label', () => {
    unlocked(false);

    render(<ResultsExportControls {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: triggerLabel });
    expect(trigger).not.toHaveAttribute('aria-label');
    expect(trigger).toHaveAccessibleName(trigger.textContent?.trim() ?? '');
  });

  it('should open the paywall when locked', async () => {
    unlocked(false);
    const user = userEvent.setup();

    render(<ResultsExportControls {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: triggerLabel }));

    expect(await screen.findByText(resultsEN.export.paywall.headline)).toBeInTheDocument();
    expect(vi.mocked(analytics.paywallView)).toHaveBeenCalled();
    expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledWith(false);
  });

  it('should open the export dialog when unlocked', async () => {
    unlocked(true);
    const user = userEvent.setup();

    render(<ResultsExportControls {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: triggerLabel }));

    expect(await screen.findByText(resultsEN.export.dialog.title)).toBeInTheDocument();
    expect(vi.mocked(analytics.paywallView)).not.toHaveBeenCalled();
    expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledWith(true);
  });

  it('should open the manual license dialog from the paywall', async () => {
    const user = userEvent.setup();
    unlocked(false);

    render(<ResultsExportControls {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: triggerLabel }));
    await user.click(
      await screen.findByRole('button', { name: resultsEN.export.license.havePurchase })
    );

    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('should not mount any modal before the button is clicked', () => {
    unlocked(true);

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.queryByText(resultsEN.export.dialog.title)).not.toBeInTheDocument();
    expect(screen.queryByText(resultsEN.export.paywall.headline)).not.toBeInTheDocument();
  });

  // Once the trigger leaves the sticky bar it is rendered on every load but seen
  // only after a scroll, so /results pageviews stop being a valid CTR
  // denominator. These three assertions are what make the new denominator real.
  describe('viewable impression', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should not report a viewable impression on mount', () => {
      unlocked(false);

      render(<ResultsExportControls {...defaultProps} />);

      expect(vi.mocked(analytics.exportTriggerViewable)).not.toHaveBeenCalled();
    });

    it('should report one viewable impression after the MRC dwell', () => {
      unlocked(false);

      render(<ResultsExportControls {...defaultProps} />);
      dwell();

      expect(vi.mocked(analytics.exportTriggerViewable)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(analytics.exportTriggerViewable)).toHaveBeenCalledWith(false);
    });

    // A returning purchaser sees this trigger on every visit and will never buy
    // again. Mixing them into the denominator understates the CTR of the people
    // the funnel is actually measuring.
    it('should mark the impression with the unlock state', () => {
      unlocked(true);

      render(<ResultsExportControls {...defaultProps} />);
      dwell();

      expect(vi.mocked(analytics.exportTriggerViewable)).toHaveBeenCalledWith(true);
    });
  });
});
