import { Blob as NodeBlob } from 'node:buffer';

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

let sendBeacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

/** Last body handed to sendBeacon, parsed. */
async function lastBeaconBody(): Promise<unknown> {
  const blob = sendBeacon.mock.calls.at(-1)?.[1] as Blob;
  return JSON.parse(await blob.text());
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

    sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon, language: 'en-US' });
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    // jsdom's own Blob implements only slice/size/type — no text()/arrayBuffer() —
    // and lastBeaconBody() below needs to read the payload back. Stubbed here,
    // file-local, rather than in shared test setup, so every other test keeps
    // jsdom's Blob (restored by vi.unstubAllGlobals() in afterEach).
    vi.stubGlobal('Blob', NodeBlob);
  });

  afterEach(() => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('holds events until something flushes them', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    expect(getQueuedCount()).toBe(1);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('sends N events in a single request', async () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results_end' });
    enqueueEvent(AnalyticsEvents.DONATION_CARD_IMPRESSION, { account_count: 42 });

    flushEvents();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const body = (await lastBeaconBody()) as Array<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    expect(body).toHaveLength(3);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(`${ORIGIN}/api/batch`);
    expect(body[0]).toMatchObject({
      type: 'event',
      payload: { website: WEBSITE_ID, name: 'ad_slot_viewable', data: { slot: 'results' } },
    });
  });

  it('flushes by itself once the size cap is reached', () => {
    for (let i = 0; i < MAX_BATCH_SIZE; i += 1) {
      enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: `s${i}` });
    }

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(getQueuedCount()).toBe(0);
  });

  it('empties the queue before sending, so a second flush cannot re-send', () => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();
    flushEvents();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the queue is empty', () => {
    flushEvents();

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls through to keepalive fetch when sendBeacon refuses the payload', () => {
    // sendBeacon reports the 64 KiB queue overflow by returning false. It does
    // not throw, so only the boolean reveals the failure.
    sendBeacon.mockReturnValue(false);
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe('POST');
  });

  it('records the path at enqueue time, not at flush time', async () => {
    window.history.pushState({}, '', '/upload');
    enqueueEvent(AnalyticsEvents.LOADING_TIP_IMPRESSION, { tip_id: 'nordvpn' });
    window.history.pushState({}, '', '/results');

    flushEvents();

    const body = (await lastBeaconBody()) as Array<{ payload: { url: string } }>;
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

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('drops pending events when consent is withdrawn, rather than delivering them', async () => {
    const { optOutOfTracking } = await import('@/lib/stats/core');
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });
    expect(getQueuedCount()).toBe(1);

    optOutOfTracking();

    expect(getQueuedCount()).toBe(0);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon throws instead of returning false', () => {
    // Some browsers (and extensions that patch the API) throw rather than
    // returning false on failure — the try/catch must still route to fetch.
    sendBeacon.mockImplementation(() => {
      throw new Error('sendBeacon blocked');
    });
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getQueuedCount()).toBe(0);
  });

  it('falls back to fetch when navigator.sendBeacon does not exist at all', () => {
    // Older/embedded WebViews lack sendBeacon entirely — the optional chaining
    // must skip straight to the fetch fallback without throwing.
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: undefined });
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, { slot: 'results' });

    flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getQueuedCount()).toBe(0);
  });
});
