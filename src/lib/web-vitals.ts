import { analytics } from '@/lib/analytics';

/**
 * Web Vitals field performance tracking.
 *
 * Reports LCP, INP, CLS, FCP, TTFB to Umami with 10% sampling.
 * Uses dynamic import to avoid adding to main bundle.
 *
 * Call once from client-side entry point.
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
