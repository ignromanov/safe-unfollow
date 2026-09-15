import { analytics } from '@/lib/analytics';

/**
 * Web Vitals field performance tracking.
 *
 * Reports LCP, INP, CLS, FCP, TTFB to Umami.
 * Uses dynamic import to avoid adding to main bundle.
 *
 * The sample rate is stated once, at `analytics.webVital` in `lib/stats/events.ts`.
 * Do not restate it here. This comment used to carry its own figure and it drifted:
 * it named a rate the gate has not used for as long as the analytics database has
 * existed. A guard in `__tests__/lib/web-vital-sampling-single-source.test.ts`
 * now fails on any literal percentage in this file.
 *
 * Call once from client-side entry point. Once per HARD page load, not per
 * pageview — Umami counts an SPA route change as a pageview and this does not
 * re-run, so the two differ by ~3.9x and a per-pageview rate computed from these
 * events is wrong by that factor.
 */
export function initWebVitals(): void {
  // Dynamic import — web-vitals is only loaded on client, tree-shaken from SSG
  import('web-vitals')
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const report = (metric: { name: string; value: number; rating: string }) => {
        analytics.webVital(metric.name, metric.value, metric.rating);
      };

      onLCP(report);
      onINP(report);
      onCLS(report);
      onFCP(report);
      onTTFB(report);
    })
    .catch(() => {
      // Silently fail — web-vitals is non-critical
    });
}
