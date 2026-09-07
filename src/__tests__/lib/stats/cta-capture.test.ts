import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: vi.fn(),
  flushEvents: vi.fn(),
}));

import {
  PENDING_CTA_KEY,
  drainPendingCTA,
  installCTACapture,
  recordCTA,
} from '@/lib/stats/cta-capture';
import { getEntryCTA } from '@/lib/stats/utm';

describe('CTA capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    delete window.__ctaSink;
  });

  it('records a hero CTA as both its event and the session entry CTA', () => {
    recordCTA('upload_direct');

    expect(enqueueEvent).toHaveBeenCalledWith('hero_cta_upload_direct', undefined);
    expect(getEntryCTA()).toBe('upload_direct');
  });

  it('replays a click parked before hydration, marked with where it happened', () => {
    // What the inline listener in index.html writes when no sink is installed yet.
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'upload_direct', p: '/id' }));

    drainPendingCTA();

    expect(enqueueEvent).toHaveBeenCalledWith('hero_cta_upload_direct', {
      deferred: true,
      from_path: '/id',
    });
    // The whole point: the attribution lands on the CTA that was actually tapped.
    expect(getEntryCTA()).toBe('upload_direct');
  });

  it('consumes a parked click exactly once', () => {
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'guide', p: '/' }));

    drainPendingCTA();
    drainPendingCTA();

    expect(enqueueEvent).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(PENDING_CTA_KEY)).toBeNull();
  });

  it('discards a parked value that names no known CTA', () => {
    // sessionStorage is writable by anything running on the origin, and a stale
    // entry outlives a rename. An unknown slug must not reach enqueueEvent, which
    // would put an unlisted event name into the dashboard.
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'not_a_cta', p: '/' }));

    drainPendingCTA();

    expect(enqueueEvent).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_CTA_KEY)).toBeNull();
  });

  it('takes a click straight through once installed, parking nothing', () => {
    installCTACapture();

    window.__ctaSink?.('sample');

    expect(enqueueEvent).toHaveBeenCalledWith('hero_cta_sample', undefined);
    expect(sessionStorage.getItem(PENDING_CTA_KEY)).toBeNull();
  });

  it('drains anything parked before it installs the sink', () => {
    // Order matters: install-then-drain would let a click landing in between be
    // recorded twice, once by each path.
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'continue', p: '/' }));

    installCTACapture();

    expect(enqueueEvent).toHaveBeenCalledWith('hero_cta_continue', {
      deferred: true,
      from_path: '/',
    });
  });

  it('records an intent CTA without touching entry_cta', () => {
    installCTACapture();

    window.__ctaSink!('who-doesnt-follow-me-back');

    expect(enqueueEvent).toHaveBeenCalledWith('intent_cta_click', {
      intent_slug: 'who-doesnt-follow-me-back',
    });
    // The whole point: an intent slug must never win the session's entry CTA — see
    // cta-capture.ts's recordIntent docstring.
    expect(getEntryCTA()).toBeNull();
  });

  it('still writes entry_cta for a hero CTA — the control', () => {
    installCTACapture();

    window.__ctaSink!('sample');

    expect(getEntryCTA()).toBe('sample');
  });

  it('replays an intent CTA parked before hydration', () => {
    sessionStorage.setItem(
      PENDING_CTA_KEY,
      JSON.stringify({ c: 'who-doesnt-follow-me-back', p: '/who-doesnt-follow-me-back' })
    );

    drainPendingCTA();

    expect(enqueueEvent).toHaveBeenCalledWith('intent_cta_click', {
      intent_slug: 'who-doesnt-follow-me-back',
      deferred: true,
      from_path: '/who-doesnt-follow-me-back',
    });
    expect(getEntryCTA()).toBeNull();
  });

  it('discards a slug it does not know', () => {
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'who-doesnt-follow-me-back-v2' }));

    drainPendingCTA();

    expect(enqueueEvent).not.toHaveBeenCalled();
  });
});
