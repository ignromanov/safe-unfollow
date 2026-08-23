import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    feedbackPromptViewable: vi.fn(),
    feedbackPromptClick: vi.fn(),
  },
}));

vi.mock('@/lib/feedback/tally', () => ({
  openFeedbackForm: vi.fn().mockResolvedValue(undefined),
}));

import { FeedbackPrompt } from '@/components/FeedbackPrompt';
import { analytics } from '@/lib/analytics';
import { openFeedbackForm } from '@/lib/feedback/tally';

/** Observed elements, in observe() order, with their observer callbacks. Same shape
 * as ResultsExportControls.test.tsx's helper — useAdViewability is the shared hook. */
let observed: Array<{ element: Element; callback: IntersectionObserverCallback }>;
let realObserver: typeof IntersectionObserver;

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

describe('FeedbackPrompt', () => {
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

  it('renders nothing for sample data', () => {
    render(<FeedbackPrompt isSample />);

    expect(screen.queryByTestId('feedback-prompt')).not.toBeInTheDocument();
  });

  /**
   * The PR #79 invariant this component inherits despite never shipping in
   * prerendered HTML itself (/results is client-only — see vite.config.ts).
   * A `<button onClick>` attaches its handler at the same render that draws
   * it, so nothing here is dead the way a prerendered control would be; the
   * `disabled` state is still required by the team's convention for any
   * control gated on `useIsClient`, and this is the one place that convention
   * can be checked: server-rendered markup, before React has ever run.
   */
  it('renders the trigger disabled during server render', () => {
    const html = renderToString(<FeedbackPrompt />);

    expect(html).toContain(resultsEN.feedback.cta);
    expect(html).toMatch(/<button[^>]*\bdisabled\b[^>]*>/);
  });

  it('is enabled once mounted on the client', () => {
    render(<FeedbackPrompt />);

    expect(screen.getByRole('button', { name: resultsEN.feedback.cta })).toBeEnabled();
  });

  it('reports the click before opening the form', async () => {
    const user = userEvent.setup();
    render(<FeedbackPrompt />);

    await user.click(screen.getByRole('button', { name: resultsEN.feedback.cta }));

    expect(analytics.feedbackPromptClick).toHaveBeenCalledTimes(1);
    expect(openFeedbackForm).toHaveBeenCalledTimes(1);

    const clickOrder = vi.mocked(analytics.feedbackPromptClick).mock.invocationCallOrder[0];
    const openOrder = vi.mocked(openFeedbackForm).mock.invocationCallOrder[0];
    expect(clickOrder).toBeLessThan(openOrder);
  });

  it('opens the form with exactly the three approved fields', async () => {
    const user = userEvent.setup();
    render(<FeedbackPrompt />);

    await user.click(screen.getByRole('button', { name: resultsEN.feedback.cta }));

    expect(openFeedbackForm).toHaveBeenCalledWith({
      locale: 'en',
      page: 'results',
      version: expect.any(String),
    });
  });

  it('reports one viewable impression after the MRC dwell', () => {
    vi.useFakeTimers();
    render(<FeedbackPrompt />);

    dwell();

    expect(analytics.feedbackPromptViewable).toHaveBeenCalledTimes(1);
  });

  it('does not report a second viewable impression on a later scroll', () => {
    vi.useFakeTimers();
    render(<FeedbackPrompt />);

    dwell();
    dwell();

    expect(analytics.feedbackPromptViewable).toHaveBeenCalledTimes(1);
  });

  it('does not report a viewable impression for sample data', () => {
    vi.useFakeTimers();
    render(<FeedbackPrompt isSample />);

    dwell();

    expect(analytics.feedbackPromptViewable).not.toHaveBeenCalled();
  });
  // Three design decisions here are load-bearing and none of them is visible
  // from the behaviour above. Each was a real defect in the first version of
  // this component, found in review on 2026-08-23, so each gets a named test
  // rather than a comment: an intention that nothing checks is not a property.
  describe('the weight it claims against the donation card above it', () => {
    it('carries no fill, so the mandatory notice keeps its contrast', () => {
      render(<FeedbackPrompt />);

      // `text-muted-foreground` at 12px measures 4.32:1 on `bg-muted` and
      // 4.72:1 on the page background. The notice is velum-cdpo's condition 3
      // and is the one line here that may not be hard to read.
      expect(screen.getByTestId('feedback-prompt').className).not.toContain('bg-muted');
    });

    it('never stretches its trigger to the full width', () => {
      render(<FeedbackPrompt />);

      // The donation card's CTA is auto-width. This ask is forecast at ~7
      // responses a month against $5.50 a sale on the export above it, so its
      // control must not be the widest thing in the tail.
      expect(screen.getByRole('button').className).not.toMatch(/(^|\s)w-full(\s|$)/);
    });

    it('renders exactly one icon, not one per breakpoint pair', () => {
      const { container } = render(<FeedbackPrompt />);

      // Two copies exist in the markup because the lead glyph moves between
      // breakpoints, but only one is ever painted; a second glyph inside the
      // button would put the same shape on screen twice at 390px.
      expect(container.querySelectorAll('svg')).toHaveLength(2);
      expect(screen.getByRole('button').querySelector('svg')).toBeNull();
    });
  });
});
