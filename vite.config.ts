import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vite";
import { buildConfig } from "./vite/build-config";
import { pwaConfig } from "./vite/pwa-config";
import { injectLocalizedMeta } from "./vite/ssg-meta-injector";
import { SUPPORTED_LANGUAGES } from "./src/config/languages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaConfig),
    // Copy @fontsource font files to /files/ directory
    // Required because @fontsource CSS references fonts via relative ./files/ paths
    // Only copy *-wght-normal.woff2 (variable weight, normal style) - reduces 50 → 11 files
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@fontsource-variable/inter/files/*-wght-normal.woff2',
          dest: 'files'
        },
        {
          src: 'node_modules/@fontsource-variable/plus-jakarta-sans/files/*-wght-normal.woff2',
          dest: 'files'
        }
      ]
    }),
  ],
  base: "/",
  // Include font assets from @fontsource packages
  assetsInclude: ["**/*.woff2", "**/*.woff"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tests": path.resolve(__dirname, "src/__tests__"),
    },
  },
  // SSG Configuration
  ssgOptions: {
    // Pages to prerender at build time
    // Client-only pages (results, sample) will be handled by SPA fallback
    script: "async",
    formatting: "minify",
    beastiesOptions: {
      // Inline critical CSS and @font-face rules
      inlineFonts: true,     // Inline @font-face rules to resolve font URLs
      preloadFonts: false,   // DISABLED: Causes "preloaded but not used" warnings
      preload: "body",       // Move full CSS to end of <body> (CSP-safe, no inline onload handler)
    },

    // Include dynamic routes (wizard steps 1-8, 404) for all languages
    includedRoutes(paths) {
      const wizardSteps = Array.from({ length: 8 }, (_, i) => i + 1);
      const dynamicRoutes: string[] = [];

      // Add wizard steps for English
      wizardSteps.forEach(step => {
        dynamicRoutes.push(`/wizard/step/${step}`);
      });

      // Add 404 page for Vercel static fallback
      dynamicRoutes.push('/404');

      // Add wizard steps and 404 for other languages (from shared config)
      SUPPORTED_LANGUAGES.filter(lang => lang !== 'en').forEach(lang => {
        wizardSteps.forEach(step => {
          dynamicRoutes.push(`/${lang}/wizard/step/${step}`);
        });
        // Note: 404 only needs English version - Vercel uses single 404.html
      });

      return [...paths, ...dynamicRoutes];
    },

    // Hook to inject localized meta tags, canonical, hreflang for each page
    async onPageRendered(route, renderedHTML) {
      return injectLocalizedMeta(route, renderedHTML, __dirname);
    },
    // Note: vite-react-ssg generates 404.html directly at dist root (Vercel convention)
  },
  build: buildConfig,
});
