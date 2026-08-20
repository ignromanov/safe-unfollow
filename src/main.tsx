import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import { initI18n } from './locales';
import { loadUmami, loadHeatmapRecorder } from './lib/umami-loader';
import './styles.css';

/**
 * SSG Entry Point
 *
 * ViteReactSSG handles:
 * - Static site generation at build time
 * - Client-side hydration
 * - React Router integration
 *
 * Routes are prerendered based on routes.tsx configuration
 * ThemeProvider is applied in Layout component
 */
export const createRoot = ViteReactSSG(
  {
    routes,
    basename: import.meta.env.BASE_URL,
    // React Router v7 future flags
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  },
  async ({ isClient }) => {
    // Initialize i18n
    // - SSG (isClient=false): Loads ALL languages for prerendering
    // - Client (isClient=true): Loads only the language from URL
    await initI18n({ isClient });

    // Client-side only initialization
    if (isClient) {
      // Load analytics (respects user opt-out)
      loadUmami();

      // Heatmap recorder — landing page only, after the first interaction (GH#95)
      loadHeatmapRecorder();

      // Report Web Vitals (LCP, INP, CLS, FCP, TTFB) with 10% sampling
      import('./lib/web-vitals').then(({ initWebVitals }) => initWebVitals());
    }
  }
);
