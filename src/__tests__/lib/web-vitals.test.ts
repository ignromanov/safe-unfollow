import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearEventQueue } from '@/lib/stats/queue';
import { initWebVitals } from '@/lib/web-vitals';

const WEBSITE_ID = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';
const ORIGIN = 'https://m.safeunfollow.app';

type Reporter = (metric: { name: string; value: number; rating: string }) => void;

/** Captured callbacks, keyed by metric, so a test decides when each one fires. */
const reporters: Record<string, Reporter> = {};

/**
 * When set, the CLS mock behaves like the real library: it finalizes its value
 * from a `visibilitychange` listener it registered at `onCLS` time, i.e. during
 * the very dispatch in which our own flush runs.
 */
let clsFinalizedOnHide: number | null = null;

vi.mock('web-vitals', () => ({
  onLCP: (cb: Reporter) => {
    reporters.LCP = cb;
  },
  onINP: (cb: Reporter) => {
    reporters.INP = cb;
  },
  onCLS: (cb: Reporter) => {
    reporters.CLS = cb;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsFinalizedOnHide !== null) {
        cb({ name: 'CLS', value: clsFinalizedOnHide, rating: 'good' });
      }
    });
  },
  onFCP: (cb: Reporter) => {
    reporters.FCP = cb;
  },
  onTTFB: (cb: Reporter) => {
    reporters.TTFB = cb;
  },
}));

let fetchMock: ReturnType<typeof vi.fn>;

function lastFetchBody(): Array<{ type: string; payload: Record<string, unknown> }> {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body as string;
  return JSON.parse(body);
}

/**
 * Listeners `initWebVitals` registers, so each test can take them back off.
 *
 * Nothing in production removes them — the function runs once per hard page load
 * and the listeners die with the document. In a shared jsdom they survive every
 * test in the file, and the count they inflate is the very count these tests
 * assert on: before this existed, the single-row test read 6, 8 and 10 calls on
 * its three attempts, none of which was about the code under test.
 */
const teardown: Array<() => void> = [];

function captureListeners(): void {
  const docAdd = document.addEventListener.bind(document);
  const winAdd = window.addEventListener.bind(window);

  document.addEventListener = (type: string, handler: EventListenerOrEventListenerObject) => {
    teardown.push(() => document.removeEventListener(type, handler));
    docAdd(type, handler);
  };
  window.addEventListener = (type: string, handler: EventListenerOrEventListenerObject) => {
    teardown.push(() => window.removeEventListener(type, handler));
    winAdd(type, handler);
  };

  teardown.push(() => {
    document.addEventListener = docAdd;
    window.addEventListener = winAdd;
  });
}

/** Drive the browser signal that ends a page's life. */
function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('initWebVitals', () => {
  beforeEach(async () => {
    vi.stubEnv('DEV', false);
    clsFinalizedOnHide = null;
    // The legacy 3% per-metric event shares this gate; pinning it high keeps the
    // parallel emitter silent so these assertions see the census payload alone.
    vi.spyOn(Math, 'random').mockReturnValue(1);
    localStorage.clear();
    clearEventQueue();
    for (const key of Object.keys(reporters)) delete reporters[key];

    const script = document.createElement('script');
    script.setAttribute('src', `${ORIGIN}/script.js`);
    script.setAttribute('data-website-id', WEBSITE_ID);
    document.head.appendChild(script);

    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    captureListeners();
    initWebVitals();
    await vi.waitFor(() => expect(reporters.TTFB).toBeDefined());
  });

  afterEach(() => {
    while (teardown.length > 0) teardown.pop()?.();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('delivers the accumulated metrics itself, without waiting for another flush', () => {
    reporters.TTFB?.({ name: 'TTFB', value: 120.4, rating: 'good' });
    reporters.LCP?.({ name: 'LCP', value: 2100.7, rating: 'needs-improvement' });

    hidePage();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = lastFetchBody();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      type: 'performance',
      payload: { website: WEBSITE_ID, ttfb: 120, lcp: 2101 },
    });
  });

  it('keeps CLS as a fraction, because rounding it to an integer erases every real score', () => {
    reporters.CLS?.({ name: 'CLS', value: 0.0512, rating: 'good' });

    hidePage();

    const body = lastFetchBody();
    expect(body[0]?.payload.cls).toBeCloseTo(0.0512, 4);
  });

  it('sends one row per page load, however many times the browser signals the end', () => {
    reporters.TTFB?.({ name: 'TTFB', value: 100, rating: 'good' });

    hidePage();
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('carries a metric the library only finalizes during the hiding dispatch', () => {
    // web-vitals reports CLS and INP when the page hides, from listeners it
    // registered when `onCLS`/`onINP` were called. Ours must be registered after
    // theirs, or it reads `metrics` a beat too early and ships the page without
    // its two most expensive numbers — silently, and only on real browsers.
    clsFinalizedOnHide = 0.0731;

    hidePage();

    const body = lastFetchBody();
    expect(body[0]?.payload.cls).toBeCloseTo(0.0731, 4);
  });

  it('omits a metric that never fired instead of sending it as a zero', () => {
    // A zero LCP is a valid-looking excellent score. Sent for a page that simply
    // never produced an LCP candidate, it drags the p75 down and the report has
    // no way to tell the two apart — the report reads every non-null value and
    // asks no questions.
    reporters.TTFB?.({ name: 'TTFB', value: 90, rating: 'good' });

    hidePage();

    const payload = lastFetchBody()[0]?.payload ?? {};
    expect(payload).not.toHaveProperty('lcp');
    expect(payload).not.toHaveProperty('inp');
    expect(payload).not.toHaveProperty('cls');
    expect(payload).not.toHaveProperty('fcp');
    expect(payload.ttfb).toBe(90);
  });
});
