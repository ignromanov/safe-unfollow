import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import { buildConfig } from "./vite/build-config";
import { pwaConfig } from "./vite/pwa-config";
import { injectLocalizedMeta } from "./vite/ssg-meta-injector";
import { SUPPORTED_LANGUAGES } from "./src/config/languages";
import pkg from "./package.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Build version for the Tally feedback hidden field (src/lib/feedback/tally.ts).
  // Vercel's build environment exposes the commit sha, not `VITE_`-prefixed, so it
  // is read here at build time and inlined — never a runtime env read.
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? pkg.version
    ),
  },
  plugins: [
    react(),
    VitePWA(pwaConfig),
    // A viteStaticCopy() of the @fontsource woff2 files into dist/files/ stood here until
    // 2026-08-20. It existed to satisfy the packages' relative `url(./files/…)`, but the
    // stylesheet that carries those urls is emitted at /assets/, so they resolved to
    // /assets/files/ and the copies were never fetched by anything. The packages are now
    // imported from src/main.tsx, which puts them through Vite's asset pipeline and hashes
    // the urls properly — nothing needs copying.
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
