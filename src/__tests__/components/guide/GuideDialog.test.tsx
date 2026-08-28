import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

vi.mock('@/lib/analytics', () => ({
  analytics: { linkClick: vi.fn(), calendarReminderClick: vi.fn() },
}));

import { GuideDialog } from '@/components/guide/GuideDialog';
import { analytics } from '@/lib/analytics';
import { ACCOUNTS_CENTER_URL, GUIDE_STEPS, guideStepAnchorId } from '@/config/wizard-steps';

// The band useActiveStep narrows its root to, for telling its observer apart
// from useSectionsInView's 200px preload one — both watch the same anchors.
const ACTIVE_STEP_ROOT_MARGIN = '0px 0px -70% 0px';

/**
 * A minimal IntersectionObserver stub, recording each instance's `rootMargin`
 * alongside its observed elements. Two hooks in GuideDialog run an observer
 * over the same anchors for two different questions (what to preload vs.
 * where the reader is); a test driving one must not also fire the other.
 */
let observed: Array<{
  element: Element;
  callback: IntersectionObserverCallback;
  rootMargin?: string;
}>;
let realObserver: typeof IntersectionObserver;

function reportActiveSection(step: number) {
  const target = document.querySelector(`#${guideStepAnchorId(step)}`) as Element;
  const entries = observed.filter(entry => entry.rootMargin === ACTIVE_STEP_ROOT_MARGIN);
  act(() => {
    for (const { element, callback } of entries) {
      callback(
        [{ isIntersecting: element === target, target: element } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    }
  });
}

function open(props: Partial<React.ComponentProps<typeof GuideDialog>> = {}) {
  return render(
    <GuideDialog
      open
      step={null}
      source="accordion"
      onGoToStep={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  );
}

describe('GuideDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observed = [];
    realObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      private rootMargin?: string;
      constructor(
        private callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        this.rootMargin = options?.rootMargin;
      }
      observe(element: Element): void {
        observed.push({ element, callback: this.callback, rootMargin: this.rootMargin });
      }
      disconnect(): void {
        observed = observed.filter(entry => entry.callback !== this.callback);
      }
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = realObserver;
  });

  it('has exactly one DialogTitle', () => {
    // GH#140: two DialogTitles in one DialogContent make aria-labelledby
    // ambiguous. The defect is live in LicenseDialog and ExportDialog — this
    // dialog does not join them.
    open();

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('declares its own scroll container', () => {
    // DialogContent is a centred `fixed` with no max-height and no overflow.
    // Seven sections in one scroll need a container, and it is this container
    // that scrolls to a section anchor.
    open();

    expect(document.querySelector('[data-guide-scroll]')).not.toBeNull();
  });

  it('renders all seven sections in one scroll', () => {
    open();

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(GUIDE_STEPS.length);
  });

  it('links to Accounts Center regardless of how the dialog was opened', () => {
    // Regression: this used to render only for source === 'url'. Four of six
    // entry points — the StepAccordion row and all three UploadZone triggers
    // — produce 'accordion' or 'zone', and none of steps.1..7 ever says where
    // Meta's profile picker lives, so those readers had no way to reach it
    // from inside the dialog at all.
    open({ source: 'accordion' });

    const cta = screen.getAllByRole('link', { name: /accounts center/i })[0];
    expect(cta).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
  });

  it('links to Accounts Center a second time, from the footer', () => {
    // The footer used to end on the reminder alone. Instagram takes 5-30
    // minutes to prepare the export, so a reader who just finished reading
    // hasn't asked for anything yet — the reminder is secondary, this is not.
    open({ source: 'accordion' });

    const links = screen.getAllByRole('link', { name: /accounts center/i });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
    }
  });

  it('states the privacy promise inside the dialog', () => {
    // Three artboards, ~three screens of scroll, a full-screen overlay — and
    // not one line saying the export never leaves the browser, on a product
    // where that is the single load-bearing promise.
    open();

    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });

  it('ends with the reminder, not with an upload it cannot honour', async () => {
    // Instagram takes 5-30 minutes to send the file. A guide that ends in
    // "upload it now" ends in a thing the reader cannot do.
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    open();

    await user.click(screen.getByRole('button', { name: wizardEN.calendar.addReminder }));

    expect(analytics.calendarReminderClick).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('closes from its own ending, and reports nothing for it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open({ onClose });

    const scroll = document.querySelector('[data-guide-scroll]') as HTMLElement;
    await user.click(within(scroll).getByRole('button', { name: wizardEN.buttons.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks the rail for a section rather than navigating', async () => {
    const onGoToStep = vi.fn();
    const user = userEvent.setup();
    open({ onGoToStep });

    await user.click(screen.getByRole('button', { name: 'Step 5' }));

    expect(onGoToStep).toHaveBeenCalledExactlyOnceWith(5);
  });

  it('makes the scroll container reachable by keyboard in browsers that do not do this natively', () => {
    // Chrome focuses an overflow container by default; Firefox and Safari do
    // not, and the seven sections carry no interactive element of their own.
    open();

    const scroll = document.querySelector('[data-guide-scroll]') as HTMLElement;
    expect(scroll).toHaveAttribute('tabindex', '0');
    expect(scroll).toHaveAttribute('role', 'group');
    expect(scroll).toHaveAttribute(
      'aria-label',
      wizardEN.entry.accordion.trigger.replace('{{count}}', String(GUIDE_STEPS.length))
    );
  });

  it('moves focus to the newly claimed section, not just the viewport', () => {
    // A reader deep-linked to ?step=5 (or navigating between guide links
    // while the dialog stays open) would otherwise see section 5 while focus
    // stayed wherever Radix's own autofocus put it.
    //
    // Rendered via a step *change* rather than the initial mount only because
    // that is what the assertion needs — a *second* claimed section, to prove
    // focus follows it rather than having landed there some other way. It is
    // no longer a workaround for anything: the scroll container attaches via
    // a callback ref (`setScrollEl`), so the arrival effect below sees a real
    // node on the commit it is born, not on a later one it has already missed
    // — see 'scrolls to the URL-claimed step on the very first open' for that
    // path tested directly.
    const { rerender } = open({ step: 3, source: 'url' });
    rerender(<GuideDialog open step={5} source="url" onGoToStep={vi.fn()} onClose={vi.fn()} />);

    expect(document.activeElement).toBe(document.querySelector('#guide-step-5-heading'));
  });

  it('scrolls to the URL-claimed step on the very first open', () => {
    // Regression: with the scroll container behind a `useRef` instead of a
    // callback ref, this never fired. Radix's Portal (the thing that actually
    // mounts this container) gates its first render on its own internal
    // `useState(false)`, flipped by a `useLayoutEffect` — so on the commit
    // this dialog first opens, an effect reading `scrollRef.current`
    // synchronously still saw null, and — with `[scrollRef, enabled]` as its
    // only deps, both already stable — never got a second chance to look.
    // `?step=N` had, in effect, never scrolled on open; only a later rail tap
    // worked, because it bumps `scrollNonce` well after the dialog settles.
    const scrollSpy = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollSpy;

    open({ step: 5, source: 'url' });

    // `behavior: 'auto'`, not merely "was called": the callback ref makes the
    // arrival effect run twice per opening, and the first run has no
    // container to scroll. If it still flips `hasArrivedRef`, the run that
    // does scroll reads it as a repeat visit and animates — the jump becomes
    // a smooth crawl past four sections, and a bare toHaveBeenCalled() is
    // green either way.
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    Element.prototype.scrollTo = originalScrollTo;
  });

  it('scrolls the section the rail is tapped for, even when it is the one already claimed', async () => {
    // Regression: tapping the rail segment for the current step used to be a
    // no-op, because the scroll effect keyed only on `step` and a tap on the
    // current step changes nothing in the URL.
    const scrollSpy = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollSpy;
    const user = userEvent.setup();
    open({ step: 5, source: 'url', onGoToStep: vi.fn() });
    scrollSpy.mockClear(); // drop the scroll from arrival itself

    await user.click(screen.getByRole('button', { name: 'Step 5' }));

    expect(scrollSpy).toHaveBeenCalled();
    Element.prototype.scrollTo = originalScrollTo;
  });

  it('renders nothing at all while closed', () => {
    render(
      <GuideDialog open={false} step={null} source="url" onGoToStep={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the URL-claimed step in the rail before anything has been observed', () => {
    // GuideRail's `current` is `activeStep ?? step` — the observer's report
    // takes over once it has one, but the URL's claim is what shows first,
    // in the one frame before the observer's first callback arrives.
    open({ step: 4, source: 'url' });

    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument();
  });

  it('attaches its observer to all seven anchors on a plain mount, no rerender workaround', () => {
    // Rendered exactly like `open()` always has — `open` already true from
    // the first commit, no step-change or open-transition rerender. Radix's
    // Portal (the thing that actually mounts the scroll container) gates its
    // own first render on a `useState(false)`, so a plain ref's `.current`
    // read stayed null forever on this exact path; the callback ref is what
    // makes there be anything to assert here at all.
    open({ step: 2, source: 'url' });

    const entries = observed.filter(entry => entry.rootMargin === ACTIVE_STEP_ROOT_MARGIN);
    expect(entries).toHaveLength(GUIDE_STEPS.length);
    const anchored = new Set(entries.map(entry => entry.element.id));
    for (const step of GUIDE_STEPS) {
      expect(anchored.has(guideStepAnchorId(step.id))).toBe(true);
    }
  });

  it('tracks the reader via the observer, not the URL, once it has reported', () => {
    open({ step: 2, source: 'url' });
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();

    reportActiveSection(5);

    expect(screen.getByText('Step 5 of 7')).toBeInTheDocument();
    const fillOf = (id: number) =>
      screen.getByRole('button', { name: `Step ${id}` }).querySelector('[data-slot="rail-fill"]');
    expect(fillOf(5)).toHaveClass('bg-primary');
    expect(fillOf(6)).toHaveClass('bg-muted-foreground');
  });
});
