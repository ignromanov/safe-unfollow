import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsEvents } from '@/lib/stats/constants';
import {
  clearEventQueue,
  enqueueEvent,
  flushEvents,
  getDeliveryStats,
  getQueuedCount,
  MAX_BATCH_SIZE,
  resetDeliveryStats,
  trackNavigating,
} from '@/lib/stats/queue';

const WEBSITE_ID = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';
const ORIGIN = 'https://umami-coral-xi.vercel.app';

let fetchMock: ReturnType<typeof vi.fn>;

/** Last body handed to fetch, parsed. */
function lastFetchBody(): unknown {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body as string;
  return JSON.parse(body);
}

describe('event queue', () => {
  beforeEach(() => {
    // Production-only guard: the queue is inert under import.meta.env.DEV.
    vi.stubEnv('DEV', false);
    localStorage.clear();
    clearEventQueue();
    resetDeliveryStats();

    const script = document.createElement('script');
    script.setAttribute('src', `${ORIGIN}/script.js`);
    script.setAttribute('data-website-id', WEBSITE_ID);
    document.head.appendChild(script);

    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('holds events until something flushes them', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    expect(getQueuedCount()).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends N events in a single request', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results_end' });
    enqueueEvent(AnalyticsEvents.DONATION_CARD_IMPRESSION, { account_count: 42 });

    flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = lastFetchBody() as Array<{ type: string; payload: Record<string, unknown> }>;
    expect(body).toHaveLength(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${ORIGIN}/api/batch`);
    expect(body[0]).toMatchObject({
      type: 'event',
      payload: { website: WEBSITE_ID, name: 'ad_slot_viewable', data: { slot: 'results' } },
    });
  });

  it('sends with keepalive so the request survives unload', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe('POST');
    // Umami answers with `Access-Control-Allow-Origin: *`, which the browser
    // rejects for any credentialed request. 'omit' is asserted rather than the
    // 'same-origin' default because the default only happens to send no cookies
    // while the instance lives on another origin (GH#63).
    expect(init.credentials).toBe('omit');
  });

  it('flushes by itself once the size cap is reached', () => {
    for (let i = 0; i < MAX_BATCH_SIZE; i += 1) {
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: `s${i}` });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getQueuedCount()).toBe(0);
  });

  it('empties the queue before sending, so a second flush cannot re-send', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();
    flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the queue is empty', () => {
    flushEvents();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records the path at enqueue time, not at flush time', () => {
    window.history.pushState({}, '', '/upload');
    enqueueEvent(AnalyticsEvents.LOADING_TIP_IMPRESSION, { tip_id: 'nordvpn' });
    window.history.pushState({}, '', '/results');

    flushEvents();

    const body = lastFetchBody() as Array<{ payload: { url: string } }>;
    expect(body[0]?.payload.url).toBe('/upload');
  });

  it('enqueues nothing while the visitor is opted out', () => {
    localStorage.setItem('umami-opt-out', 'true');

    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    expect(getQueuedCount()).toBe(0);
  });

  it('enqueues nothing when the analytics tag was never injected', () => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());

    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    expect(getQueuedCount()).toBe(0);
  });

  it('drops queued events on clear without sending them', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    clearEventQueue();
    flushEvents();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops pending events when consent is withdrawn, rather than delivering them', async () => {
    const { optOutOfTracking } = await import('@/lib/stats/core');
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });
    expect(getQueuedCount()).toBe(1);

    optOutOfTracking();

    expect(getQueuedCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never breaks the app when the delivery request fails', () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    expect(() => flushEvents()).not.toThrow();
  });

  describe('delivery reporting', () => {
    /** A batch response in the shape /api/batch documents. */
    function batchResponse(size: number, errors: number, status = 200): Response {
      return new Response(
        JSON.stringify({ size, processed: size - errors, errors, details: [], cache: 't' }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    it('counts a delivered batch', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(batchResponse(1, 0)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().batchesSent).toBe(1));
      expect(getDeliveryStats().batchesFailed).toBe(0);
      expect(getDeliveryStats().eventsRejected).toBe(0);
    });

    it('counts the events the server reports it rejected', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(batchResponse(3, 2)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'a' });
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'b' });
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'c' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().eventsRejected).toBe(2));
    });

    it('retries once on a 5xx and reports success when the retry lands', async () => {
      fetchMock
        .mockImplementationOnce(() => Promise.resolve(batchResponse(1, 0, 500)))
        .mockImplementationOnce(() => Promise.resolve(batchResponse(1, 0)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(getDeliveryStats().batchesSent).toBe(1);
      expect(getDeliveryStats().batchesFailed).toBe(0);
    });

    it('retries once on a network failure', async () => {
      fetchMock
        .mockImplementationOnce(() => Promise.reject(new Error('network down')))
        .mockImplementationOnce(() => Promise.resolve(batchResponse(1, 0)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().batchesSent).toBe(1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('resends the same batch on retry, so nothing is dropped between attempts', async () => {
      fetchMock
        .mockImplementationOnce(() => Promise.resolve(batchResponse(2, 0, 503)))
        .mockImplementationOnce(() => Promise.resolve(batchResponse(2, 0)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'a' });
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'b' });

      flushEvents();

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const [first, second] = fetchMock.mock.calls.map(
        call => (call[1] as RequestInit).body as string
      );
      expect(second).toBe(first);
    });

    it('gives up after one retry rather than looping', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(batchResponse(1, 0, 500)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().batchesFailed).toBe(1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getDeliveryStats().batchesSent).toBe(0);
    });

    it('does not retry a 4xx, because the retry would send the same rejected payload', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 400 })));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().batchesFailed).toBe(1));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a partially-failed 200, which would duplicate what already landed', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(batchResponse(3, 1)));
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'a' });
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'b' });
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'c' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().eventsRejected).toBe(1));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('treats an unreadable response body as a delivered batch, not a failure', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response('not json', { status: 200 }))
      );
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      flushEvents();

      await vi.waitFor(() => expect(getDeliveryStats().batchesSent).toBe(1));
      expect(getDeliveryStats().batchesFailed).toBe(0);
    });

    it('never rejects out of flushEvents, whatever the transport does', async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));
      const onUnhandled = vi.fn();
      window.addEventListener('unhandledrejection', onUnhandled);
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

      expect(() => flushEvents()).not.toThrow();

      await vi.waitFor(() => expect(getDeliveryStats().batchesFailed).toBe(1));
      expect(onUnhandled).not.toHaveBeenCalled();
      window.removeEventListener('unhandledrejection', onUnhandled);
    });
  });

  describe('trackNavigating', () => {
    it('delivers in the same tick instead of waiting for a batch', () => {
      trackNavigating(AnalyticsEvents.CHECKOUT_START, { locale: 'id' });

      expect(getQueuedCount()).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends with keepalive, so the navigation cannot cancel it', () => {
      trackNavigating(AnalyticsEvents.CHECKOUT_START);

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.keepalive).toBe(true);
      expect(init.credentials).toBe('omit');
    });

    it('carries anything already queued along with it', () => {
      enqueueEvent(AnalyticsEvents.DONATION_CARD_IMPRESSION, { account_count: 7 });

      trackNavigating(AnalyticsEvents.CHECKOUT_START);

      const body = lastFetchBody() as Array<{ payload: { name: string } }>;
      expect(body).toHaveLength(2);
      expect(body[1]?.payload.name).toBe('checkout_start');
    });
  });
});
