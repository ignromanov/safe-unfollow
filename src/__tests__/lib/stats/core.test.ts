import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsEvents } from '@/lib/stats/constants';
import { trackBeacon } from '@/lib/stats/core';

const WEBSITE_ID = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';
const ORIGIN = 'https://umami-coral-xi.vercel.app';

let fetchMock: ReturnType<typeof vi.fn>;
let track: ReturnType<typeof vi.fn>;

describe('trackBeacon', () => {
  beforeEach(() => {
    // Production-only guard: the whole module is inert under import.meta.env.DEV.
    vi.stubEnv('DEV', false);
    localStorage.clear();

    const script = document.createElement('script');
    script.setAttribute('src', `${ORIGIN}/script.js`);
    script.setAttribute('data-website-id', WEBSITE_ID);
    document.head.appendChild(script);

    track = vi.fn();
    window.umami = { track } as unknown as typeof window.umami;

    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());
    delete window.umami;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts one event envelope to the resolved instance', () => {
    window.history.pushState({}, '', '/results');

    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 42 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/send`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      type: 'event',
      payload: {
        website: WEBSITE_ID,
        name: 'time_on_results',
        data: { seconds: 42 },
        url: '/results',
      },
    });
  });

  it('sends uncredentialed, because Umami answers with a wildcard CORS origin', () => {
    // sendBeacon is unusable here for exactly this reason: the Beacon spec
    // forces credentials mode 'include', which the browser refuses against
    // `Access-Control-Allow-Origin: *` — silently, while reporting success.
    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('omit');
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe('POST');
  });

  it('never uses sendBeacon, whose delivery the endpoint would reject', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 1 });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the loaded tracker when no instance can be resolved', () => {
    document.head.querySelectorAll('script[data-website-id]').forEach(el => el.remove());

    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('time_on_results', { seconds: 1 });
  });

  it('sends nothing while the visitor is opted out', () => {
    localStorage.setItem('umami-opt-out', 'true');

    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('never breaks the app when the delivery request fails', () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));

    expect(() => trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, { seconds: 1 })).not.toThrow();
  });
});
