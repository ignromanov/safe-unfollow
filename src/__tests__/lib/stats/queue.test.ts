import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsEvents } from '@/lib/stats/constants';
import {
  clearEventQueue,
  enqueueEvent,
  flushEvents,
  getQueuedCount,
  MAX_BATCH_SIZE,
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
});
