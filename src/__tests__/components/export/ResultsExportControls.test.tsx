import { act, render, screen, waitFor } from '@testing-library/react';
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
      freeExportDownload: vi.fn(),
      exportError: vi.fn(),
    },
  };
});

vi.mock('@/lib/export/csv', () => ({ buildExportCsv: vi.fn() }));
vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import { buildExportCsv } from '@/lib/export/csv';
import { downloadBlob } from '@/lib/export/download';
import { FREE_EXPORT_ROWS } from '@/lib/export/free-tier';
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
    vi.mocked(buildExportCsv).mockResolvedValue(new Blob(['username\n']));
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

  // The click now downloads a real file, so the trigger must not look like a
  // purchase. It carried the price only while the click delivered nothing.
  it('should not price the trigger', () => {
    unlocked(false);

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.getByRole('button', { name: triggerLabel })).not.toHaveTextContent('$7');
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

  // The paywall headline interpolates the row cap, so the rendered text is not
  // the raw string. Matching on the stable half keeps the assertion honest
  // without duplicating i18next's interpolation in the test.
  const paywallHeadline = new RegExp(
    resultsEN.export.paywall.headline.replace('{{rows}}', String(FREE_EXPORT_ROWS))
  );

  describe('the free sample', () => {
    it('should download a capped file and only then ask for money', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      await waitFor(() => expect(vi.mocked(downloadBlob)).toHaveBeenCalled());

      // The first ten of what the reader is looking at, built by the same
      // builder the paid export uses — the sample has to be a smaller version
      // of the thing being sold, not a second code path.
      expect(vi.mocked(buildExportCsv)).toHaveBeenCalledWith(
        defaultProps.fileHash,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        defaultProps.totalCount
      );
      expect(vi.mocked(analytics.freeExportDownload)).toHaveBeenCalledWith(true);
      expect(await screen.findByText(paywallHeadline)).toBeInTheDocument();
      expect(vi.mocked(analytics.paywallView)).toHaveBeenCalled();
      expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledWith(false);
    });

    // A file that stops short must say so somewhere durable. The modal is gone
    // the moment it is dismissed; the filename is still there next week.
    it('should mark the capped file in its name', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      await waitFor(() =>
        expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(
          expect.any(Blob),
          'my-export-sample.csv'
        )
      );
    });

    // Nothing is being withheld from a view that already fits, so there is
    // nothing to sell and the file is not a sample. Pitching one anyway would
    // claim there is more, about a file the reader can open and count.
    it('should hand over the whole view untouched when it fits, and skip the pitch', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} indices={[4, 8, 15]} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      await waitFor(() =>
        expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(expect.any(Blob), 'my-export.csv')
      );
      expect(vi.mocked(buildExportCsv)).toHaveBeenCalledWith(
        defaultProps.fileHash,
        [4, 8, 15],
        defaultProps.totalCount
      );
      expect(vi.mocked(analytics.freeExportDownload)).toHaveBeenCalledWith(false);
      expect(screen.queryByText(paywallHeadline)).not.toBeInTheDocument();
      expect(vi.mocked(analytics.paywallView)).not.toHaveBeenCalled();
    });

    // The paywall asserts "the sample you just downloaded stops at 10 rows"
    // about a file the reader may never have seen land — 85% of traffic is
    // mobile, and an iOS Safari blob download can be silent or blocked. The
    // receipt is what makes that assertion checkable.
    it('should name the downloaded file in the paywall, matching what was written', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      await waitFor(() => expect(vi.mocked(downloadBlob)).toHaveBeenCalled());

      // Read the name off the download call rather than restating it: a
      // receipt naming a different file than the one on disk is worse than no
      // receipt, and only this coupling can catch the two drifting apart.
      const [, writtenName] = vi.mocked(downloadBlob).mock.calls[0];
      const receipt = resultsEN.export.saved.capped
        .replace('{{filename}}', String(writtenName))
        .replace('{{rows}}', String(FREE_EXPORT_ROWS))
        .replace('{{total}}', String(defaultProps.totalCount));

      expect(await screen.findByText(receipt)).toBeInTheDocument();
    });

    // Without this the uncapped path gives no feedback whatsoever: no paywall
    // opens, and the only evidence of the click is a file the browser may have
    // saved without saying so.
    it('should announce the saved file when the whole view fits', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} indices={[4, 8, 15]} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      const status = await screen.findByRole('status');

      expect(status).toHaveTextContent(
        resultsEN.export.saved.full
          .replace('{{filename}}', 'my-export.csv')
          .replace('{{total}}', '3')
      );
    });

    // A receipt left over from the previous run describes a file that is no
    // longer the newest one in the Downloads folder — the reader reconciles it
    // against the wrong file, which is exactly the confusion it exists to end.
    it('should drop the previous receipt when another export starts', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} indices={[4, 8, 15]} />);
      const trigger = screen.getByRole('button', { name: triggerLabel });

      await user.click(trigger);
      await screen.findByRole('status');

      let release: (blob: Blob) => void = () => {};
      vi.mocked(buildExportCsv).mockReturnValueOnce(
        new Promise<Blob>(resolve => {
          release = resolve;
        })
      );

      await user.click(trigger);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      release(new Blob(['username\n']));
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    });

    // A dead click is the worst outcome here: it is the step the whole funnel
    // narrows to, and IndexedDB on this codebase has a known no-timeout hang.
    it('should surface a failure instead of silently doing nothing', async () => {
      unlocked(false);
      vi.mocked(buildExportCsv).mockRejectedValueOnce(new Error('idb gone'));
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.dialog.error);
      expect(vi.mocked(analytics.exportError)).toHaveBeenCalledWith('csv');
      expect(vi.mocked(downloadBlob)).not.toHaveBeenCalled();
      expect(screen.queryByText(paywallHeadline)).not.toBeInTheDocument();
    });

    // Clicking again *after* a finished export is legitimate and must keep
    // working; what must not happen is a second build starting while the first
    // is still in flight, which on a slow IndexedDB read is a wide window.
    it('should not start a second build while one is in flight', async () => {
      unlocked(false);
      let release: (blob: Blob) => void = () => {};
      vi.mocked(buildExportCsv).mockReturnValueOnce(
        new Promise<Blob>(resolve => {
          release = resolve;
        })
      );
      const user = userEvent.setup();

      // A view that fits under the cap, so no paywall opens: Radix marks the
      // page `pointer-events: none` behind an open dialog, which would mask
      // whether the control itself had been released.
      render(<ResultsExportControls {...defaultProps} indices={[4, 8, 15]} />);
      const trigger = screen.getByRole('button', { name: triggerLabel });

      await user.click(trigger);

      // First layer: the button is out of reach while the build runs.
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('aria-busy', 'true');

      // Second layer: even reaching past that — a keyboard or a programmatic
      // dispatch, neither of which respects `pointer-events: none` — starts
      // nothing, because the guard is a ref rather than the render state.
      await userEvent.setup({ pointerEventsCheck: 0 }).click(trigger);

      expect(vi.mocked(buildExportCsv)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledTimes(1);

      release(new Blob(['username\n']));

      // Waiting on the button rather than on the download: the file lands one
      // render before the control releases, and a second export is legitimate
      // only once it has.
      await waitFor(() => expect(trigger).toBeEnabled());
      expect(vi.mocked(downloadBlob)).toHaveBeenCalledTimes(1);

      await user.click(trigger);
      await waitFor(() => expect(vi.mocked(buildExportCsv)).toHaveBeenCalledTimes(2));
    });
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

  // Key entry belongs to the paywall and nowhere else. Beside the trigger it
  // was shown to 100% of readers, of whom zero had purchased, and it disclosed
  // that the product is paid from under a button that says only "Export".
  describe('restoring a purchase', () => {
    const keyEntryLabel = resultsEN.export.license.havePurchase;

    it('should not offer key entry beside the trigger', () => {
      unlocked(false);

      render(<ResultsExportControls {...defaultProps} />);

      // Anchored on the trigger being there: a component that rendered nothing
      // at all would satisfy the negative assertion on its own.
      expect(screen.getByRole('button', { name: triggerLabel })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: keyEntryLabel })).not.toBeInTheDocument();
    });

    it('should not offer it beside the trigger to someone already unlocked', () => {
      unlocked(true);

      render(<ResultsExportControls {...defaultProps} />);

      expect(screen.queryByRole('button', { name: keyEntryLabel })).not.toBeInTheDocument();
    });

    // The other half of the constraint: removing the link from the header is
    // only defensible while the paywall still carries it. A buyer whose second
    // device lacks the purchase email has no other way in.
    it('should offer it in the paywall', async () => {
      unlocked(false);
      const user = userEvent.setup();

      render(<ResultsExportControls {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: triggerLabel }));

      expect(await screen.findByRole('button', { name: keyEntryLabel })).toBeInTheDocument();
    });
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
