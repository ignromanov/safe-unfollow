import { analytics } from '@/lib/analytics';
import { enqueuePerformance, flushEvents, type PerformanceMetrics } from '@/lib/stats/queue';

/**
 * Web Vitals field performance tracking.
 *
 * Two consumers, deliberately parallel for now:
 *
 * 1. `enqueuePerformance` — one census row per hard page load, carrying whatever
 *    metrics fired, written to `website_event.lcp/inp/cls/fcp/ttfb`. This is what
 *    Umami's own Performance report reads (`event_type = 5`); our custom events
 *    have never been visible there and never could be.
 * 2. `analytics.webVital` — the sampled per-metric custom event that predates it.
 *    It is the only control that can tell a working census from a silently
 *    rejected one, so it stays until the census has a week on the record. The
 *    sample rate is stated once, at `analytics.webVital` in `lib/stats/events.ts`;
 *    do not restate it here. A guard in
 *    `__tests__/lib/web-vital-sampling-single-source.test.ts` fails on any literal
 *    percentage in this file.
 *
 * Call once from the client entry point. Once per HARD page load, not per
 * pageview — Umami counts an SPA route change as a pageview and this does not
 * re-run, so the two differ by ~3.9x and a per-pageview rate computed from either
 * series is wrong by that factor.
 */
export function initWebVitals(): void {
  const metrics: PerformanceMetrics = {};
  /**
   * The route this document loaded on, captured now rather than at delivery.
   *
   * LCP, FCP and TTFB describe this load and nothing after it. The row leaves on
   * `pagehide`, by which time an SPA visit has typically moved on — 3.91
   * pageviews per page load — so reading `location` there would file the landing
   * page's load cost under whichever route the visit ended on. CLS and INP do
   * accumulate across those routes, so no single URL is right for all five; this
   * one is right for three and matches the pageview the load produced.
   */
  const url = window.location.pathname;
  let sent = false;

  /**
   * Deliver the census row exactly once.
   *
   * `flushEvents()` is called here rather than left to `useEventQueueFlush`: that
   * hook registers its own `pagehide` listener at React mount time while this
   * module arrives via a dynamic import, so which of the two runs first is not
   * decided anywhere. Enqueueing after the other listener already flushed would
   * strand the row in the queue for the rest of the page's life, and a stranded
   * row looks exactly like a page that reported nothing.
   *
   * ⚠️ So this row usually travels alone rather than sharing a request: the hook
   * also drains the queue on every route change, which normally leaves nothing
   * to ride with. Cost it as one keepalive POST per hard page load.
   */
  const flush = (): void => {
    if (sent) return;
    // The latch means delivered, not attempted. A page hidden before anything
    // resolved has nothing to say yet, and must stay able to say it later.
    if (Object.keys(metrics).length === 0) return;
    sent = true;
    enqueuePerformance(metrics, url);
    flushEvents();
  };

  // Dynamic import — web-vitals is only loaded on client, tree-shaken from SSG
  import('web-vitals')
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const report = (metric: { name: string; value: number; rating: string }) => {
        analytics.webVital(metric.name, metric.value, metric.rating);

        // CLS is a unitless ratio whose whole useful range sits below 1, so it is
        // the one metric integer rounding destroys rather than trims. The legacy
        // emitter above still rounds it, which is why its CLS series holds only
        // 0 and 1 and cannot be compared against this one.
        const key = metric.name.toLowerCase() as keyof PerformanceMetrics;
        metrics[key] = key === 'cls' ? metric.value : Math.round(metric.value);
      };

      onLCP(report);
      onINP(report);
      onCLS(report);
      onFCP(report);
      onTTFB(report);

      // Registered after the five callbacks above, and that order is load-bearing:
      // listeners run in registration order, so web-vitals finalizes CLS and INP
      // into `metrics` during this same dispatch before `flush` reads it.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
      window.addEventListener('pagehide', flush);
    })
    .catch(() => {
      // Silently fail — web-vitals is non-critical
    });
}
