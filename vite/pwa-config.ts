import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * PWA configuration for Safe Unfollow app
 * Includes manifest, service worker, and caching strategies
 */
export const pwaConfig: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.ico',
    'favicon.svg',
    'favicon-96x96.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'logo.svg',
  ],
  manifest: {
    id: '/',
    name: 'Safe Unfollow - Instagram Tracker',
    short_name: 'Safe Unfollow',
    description: 'Check who unfollowed you on Instagram - 100% private, no login required',
    theme_color: '#4E7EF5',
    background_color: '#0a0a0a',
    display: 'standalone',
    start_url: '/',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    // Force immediate SW activation (no waiting for tab close)
    // This ensures new deployments take effect immediately
    skipWaiting: true,
    clientsClaim: true,
    // Minimal precache: only icons for PWA install prompt
    // Everything else uses runtime caching to avoid 100+ requests on first visit
    globPatterns: ['**/*.{ico,png,svg}'],
    // Don't precache large sample data
    globIgnores: ['**/sample-data.json', '**/assets/**', '**/wizard/**', '**/og-image.png'],
    // Disable SPA fallback - SSG generates individual HTML files per route
    // Navigation is handled by runtimeCaching with NetworkFirst strategy
    navigateFallback: null,
    // CRITICAL: Clean up old caches when SW updates (prevents duplicate JS loading)
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        // Cache JS/CSS on-demand with StaleWhileRevalidate
        // Returns cache immediately, updates in background
        // Better than CacheFirst for frequently deployed apps
        urlPattern: /\.(?:js|css|woff2)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-assets-v2',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days (reduced from 30)
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache HTML pages on-demand (NetworkFirst = fresh content, fallback to cache)
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          // Without this Workbox never builds the race against the cache and simply
          // awaits fetch() until the browser's own long mobile timeout.
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
};
