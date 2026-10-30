import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GH#312 — the checkout return must be out of the address bar before anything
 * outside React can read it.
 *
 * Dodo sends the buyer back to `/results?license_key=…&email=…&payment_id=…`.
 * The strip used to live only in Layout's layout effect, which beats every
 * passive effect in the tree — but not the vendor tracker. `loadUmami()` runs in
 * the client bootstrap before `hydrate()`, and a script inserted from JS is async
 * whatever its `defer` says, so a cached tracker can execute first, auto-track a
 * pageview from `location.href`, then report the pre-strip URL as the referrer of
 * every later event when the strip's `replaceState` goes through its hook. Twelve
 * rows on two real visits.
 *
 * The router is the other early reader: vite-react-ssg builds it from
 * `window.location` before it awaits the bootstrap callback, and a later
 * `replaceState` never resyncs it, so it kept the params in memory for the rest
 * of the visit.
 *
 * These cases record the URL at the two moments that matter and fail if either
 * still carries a checkout param. Every value is an obvious fake.
 */

const FAKE_KEY = 'FAKE-LICENSE-KEY-0001';

const CHECKOUT_RETURN =
  `/results?utm_source=newsletter&license_key=${FAKE_KEY}` +
  '&payment_id=pay_FAKE0001&status=succeeded&email=buyer%40example.invalid';

// Mirrors `LICENSE_QUERY_PARAM` + `CHECKOUT_QUERY_PARAMS` in `unlock.ts`; spelled
// out so this test cannot be made to pass by shrinking that list.
const CHECKOUT_PARAMS = ['license_key', 'payment_id', 'subscription_id', 'status', 'email'];

type BootstrapCallback = (context: { isClient: boolean }) => Promise<void>;

const seen = vi.hoisted(() => ({
  urlAtRouter: null as string | null,
  urlAtTracker: null as string | null,
  callback: null as BootstrapCallback | null,
}));

vi.mock('vite-react-ssg', () => ({
  // On the client the real ViteReactSSG starts its bootstrap synchronously and
  // creates the router from `window.location` before it awaits the callback —
  // so the URL at this call is the URL the router is built from.
  ViteReactSSG: (_options: unknown, callback: BootstrapCallback) => {
    seen.urlAtRouter = window.location.href;
    seen.callback = callback;
    return vi.fn();
  },
}));

vi.mock('@/lib/umami-loader', () => ({
  // The real one appends the tracker synchronously; from here on the vendor
  // script may execute at any moment and read `location.href`.
  loadUmami: vi.fn(() => {
    seen.urlAtTracker = window.location.href;
  }),
  loadHeatmapRecorder: vi.fn(),
}));

vi.mock('@/routes', () => ({ routes: [] }));
vi.mock('@/locales', () => ({ initI18n: vi.fn(async () => undefined) }));
vi.mock('@/lib/stale-chunk-recovery', () => ({ installStaleChunkRecovery: vi.fn() }));
vi.mock('@/lib/web-vitals', () => ({ initWebVitals: vi.fn() }));

function checkoutParamsIn(href: string | null): string[] {
  if (href === null) throw new Error('the moment under test was never reached');
  const params = new URL(href).searchParams;
  return CHECKOUT_PARAMS.filter(param => params.has(param));
}

async function bootClient(): Promise<void> {
  await import('@/main');
  if (seen.callback === null) throw new Error('main.tsx never handed vite-react-ssg a callback');
  await seen.callback({ isClient: true });
}

describe('client bootstrap — checkout return (GH#312)', () => {
  beforeEach(() => {
    vi.resetModules();
    seen.urlAtRouter = null;
    seen.urlAtTracker = null;
    seen.callback = null;
    window.history.replaceState(null, '', CHECKOUT_RETURN);
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('carries no checkout param in the URL when the Umami tracker is injected', async () => {
    await bootClient();

    expect(checkoutParamsIn(seen.urlAtTracker)).toEqual([]);
  });

  it('carries no checkout param in the URL the router is built from', async () => {
    await bootClient();

    expect(checkoutParamsIn(seen.urlAtRouter)).toEqual([]);
  });

  it('leaves unrelated params where they were', async () => {
    await bootClient();

    expect(new URL(seen.urlAtTracker ?? '').searchParams.get('utm_source')).toBe('newsletter');
  });

  it("hands the licence key to Layout's commit-phase read from memory, exactly once", async () => {
    await bootClient();
    // Same module instance main.tsx used: resetModules ran before it, not since.
    const { consumeLicenseParam } = await import('@/lib/export/unlock');

    expect(window.location.search).toBe('?utm_source=newsletter');
    expect(consumeLicenseParam()).toBe(FAKE_KEY);
    expect(consumeLicenseParam()).toBeNull();
  });
});
