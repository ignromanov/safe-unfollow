/* eslint-disable no-console */
/**
 * Sitemap Generator (Postbuild)
 *
 * Scans dist/ for HTML files and generates sitemap.xml with hreflang links.
 * Run after SSG build: pnpm generate:sitemap
 *
 * Features:
 * - Auto-discovers all pages from dist/
 * - Generates hreflang links for i18n
 * - Per-route priority and changefreq
 * - Generates robots.txt
 */

import { readdirSync, statSync, writeFileSync } from "fs";
import { resolve, relative } from "path";

// Import from shared config (single source of truth)
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../src/config/languages";

// Configuration
const BASE_URL = "https://safeunfollow.app";
const DIST_DIR = resolve(process.cwd(), "dist");

// Use shared type
type Language = SupportedLanguage;

// Files to exclude from sitemap
const EXCLUDE_PATTERNS = [
  /^google[a-z0-9]+\.html$/, // Google verification files
  /^404\.html$/,
  /^500\.html$/,
];

// Per-route SEO settings
const ROUTE_CONFIG: Record<string, { priority: number; changefreq: string }> = {
  "/": { priority: 1.0, changefreq: "weekly" },
  "/upload": { priority: 0.8, changefreq: "monthly" },
  "/waiting": { priority: 0.6, changefreq: "monthly" },
  "/results": { priority: 0.6, changefreq: "monthly" },
  "/sample": { priority: 0.6, changefreq: "monthly" },
  "/privacy": { priority: 0.5, changefreq: "yearly" },
  "/terms": { priority: 0.5, changefreq: "yearly" },
  // Documentation pages (English only, no i18n)
  "/docs": { priority: 0.7, changefreq: "monthly" },
  "/docs/user-guide": { priority: 0.7, changefreq: "monthly" },
  "/docs/instagram-export": { priority: 0.7, changefreq: "monthly" },
  "/docs/faq": { priority: 0.7, changefreq: "monthly" },
  "/docs/troubleshooting": { priority: 0.6, changefreq: "monthly" },
  "/docs/privacy": { priority: 0.5, changefreq: "yearly" },
  "/docs/tech-spec": { priority: 0.5, changefreq: "monthly" },
  "/docs/roadmap": { priority: 0.5, changefreq: "monthly" },
  "/docs/accessibility": { priority: 0.5, changefreq: "yearly" },
  "/docs/is-it-safe": { priority: 0.7, changefreq: "monthly" },
  "/docs/compare": { priority: 0.6, changefreq: "monthly" },
  "/docs/compare/vs-unfollowgram": { priority: 0.6, changefreq: "monthly" },
  "/docs/compare/vs-followers-app": { priority: 0.6, changefreq: "monthly" },
};

// Paths that are English-only (no i18n versions)
const ENGLISH_ONLY_PATHS = [
  "/docs",
  "/docs/user-guide",
  "/docs/instagram-export",
  "/docs/faq",
  "/docs/troubleshooting",
  "/docs/privacy",
  "/docs/tech-spec",
  "/docs/roadmap",
  "/docs/accessibility",
  "/docs/is-it-safe",
  "/docs/compare",
  "/docs/compare/vs-unfollowgram",
  "/docs/compare/vs-followers-app",
];

const DEFAULT_CONFIG = { priority: 0.7, changefreq: "monthly" };

/**
 * Recursively scan directory for HTML files
 */
function scanHtmlFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      scanHtmlFiles(fullPath, files);
    } else if (entry.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Convert HTML file path to URL path
 * dist/index.html -> /
 * dist/upload.html -> /upload
 * dist/es/upload.html -> /es/upload
 * dist/es.html -> /es/
 */
function htmlPathToUrlPath(htmlPath: string): string {
  const relativePath = relative(DIST_DIR, htmlPath);

  // Handle index.html -> /
  if (relativePath === "index.html") {
    return "/";
  }

  // Handle lang.html (e.g., es.html -> /es)
  const langMatch = relativePath.match(/^([a-z]{2})\.html$/);
  if (langMatch && SUPPORTED_LANGUAGES.includes(langMatch[1] as Language)) {
    return `/${langMatch[1]}`;
  }

  // Handle nested paths: es/upload.html -> /es/upload
  // Remove .html extension
  const withoutExt = relativePath.replace(/\.html$/, "");

  // Handle index files in subdirs: es/index.html -> /es
  if (withoutExt.endsWith("/index")) {
    return "/" + withoutExt.replace(/\/index$/, "");
  }

  return "/" + withoutExt;
}

/**
 * Check if file should be excluded
 */
function shouldExclude(htmlPath: string): boolean {
  const fileName = htmlPath.split("/").pop() || "";
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(fileName));
}

/**
 * Extract language and base path from URL path
 * /es/upload -> { lang: 'es', basePath: '/upload' }
 * /upload -> { lang: 'en', basePath: '/upload' }
 * /es/ -> { lang: 'es', basePath: '/' }
 */
function parseUrlPath(urlPath: string): { lang: Language; basePath: string } {
  const langMatch = urlPath.match(/^\/([a-z]{2})(\/.*)?$/);

  if (langMatch && SUPPORTED_LANGUAGES.includes(langMatch[1] as Language)) {
    const lang = langMatch[1] as Language;
    if (lang !== "en") {
      const basePath = langMatch[2] || "/";
      return { lang, basePath: basePath === "" ? "/" : basePath };
    }
  }

  return { lang: "en", basePath: urlPath };
}

/**
 * Build full URL from base path and language
 */
function buildUrl(basePath: string, lang: Language): string {
  if (lang === "en") {
    return `${BASE_URL}${basePath}`;
  }
  // /upload -> /es/upload, / -> /es
  if (basePath === "/") {
    return `${BASE_URL}/${lang}`;
  }
  return `${BASE_URL}/${lang}${basePath}`;
}

/**
 * Get SEO config for a base path
 */
function getRouteConfig(
  basePath: string
): { priority: number; changefreq: string } {
  return ROUTE_CONFIG[basePath] || DEFAULT_CONFIG;
}

/**
 * Check if path is English-only (no i18n versions)
 */
function isEnglishOnlyPath(basePath: string): boolean {
  return ENGLISH_ONLY_PATHS.some(
    (p) => basePath === p || basePath.startsWith(p + "/")
  );
}

/**
 * Generate hreflang links for a base path
 * Returns empty string for English-only paths (docs)
 */
function generateHreflangLinks(basePath: string): string {
  // No hreflang for English-only pages
  if (isEnglishOnlyPath(basePath)) {
    return "";
  }

  const links = SUPPORTED_LANGUAGES.map((lang) => {
    const url = buildUrl(basePath, lang);
    return `        <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`;
  });

  // Add x-default pointing to English version
  const xDefaultUrl = buildUrl(basePath, "en");
  links.push(
    `        <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}"/>`
  );

  return links.join("\n");
}

/**
 * Generate URL entry for sitemap
 */
function generateUrlEntry(
  url: string,
  basePath: string,
  lang: Language,
  lastmod: string
): string {
  const config = getRouteConfig(basePath);
  // Non-English versions get slightly lower priority
  const priority = lang === "en" ? config.priority : Math.max(config.priority - 0.1, 0.1);

  const hreflangLinks = generateHreflangLinks(basePath);
  const hreflangSection = hreflangLinks ? `\n${hreflangLinks}` : "";

  return `    <url>
        <loc>${url}</loc>${hreflangSection}
        <lastmod>${lastmod}</lastmod>
        <changefreq>${config.changefreq}</changefreq>
        <priority>${priority.toFixed(1)}</priority>
    </url>`;
}

/**
 * Generate robots.txt content
 */
function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

/**
 * Main function
 */
function main(): void {
  console.log("🗺️  Generating sitemap from dist/...");

  // Scan for HTML files
  const htmlFiles = scanHtmlFiles(DIST_DIR);
  console.log(`   Found ${htmlFiles.length} HTML files`);

  // Convert to URL paths and filter
  const urlPaths = htmlFiles
    .filter((f) => !shouldExclude(f))
    .map(htmlPathToUrlPath);

  console.log(`   After filtering: ${urlPaths.length} pages`);

  // Group by base path to avoid duplicates in sitemap
  // (each base path appears once per language)
  const basePathsSet = new Set<string>();
  const urlEntries: Array<{ url: string; basePath: string; lang: Language }> = [];

  for (const urlPath of urlPaths) {
    const { lang, basePath } = parseUrlPath(urlPath);
    const url = buildUrl(basePath, lang);

    // Track unique combinations
    const key = `${lang}:${basePath}`;
    if (!basePathsSet.has(key)) {
      basePathsSet.add(key);
      urlEntries.push({ url, basePath, lang });
    }
  }

  // Add docs pages (English only, hosted via GitHub Pages/Jekyll)
  // These are built separately and served at /docs/*
  for (const docsPath of ENGLISH_ONLY_PATHS) {
    const url = buildUrl(docsPath, "en");
    const key = `en:${docsPath}`;
    if (!basePathsSet.has(key)) {
      basePathsSet.add(key);
      urlEntries.push({ url, basePath: docsPath, lang: "en" });
    }
  }

  // Sort: English first, then by path
  urlEntries.sort((a, b) => {
    if (a.lang === "en" && b.lang !== "en") return -1;
    if (a.lang !== "en" && b.lang === "en") return 1;
    return a.basePath.localeCompare(b.basePath) || a.lang.localeCompare(b.lang);
  });

  // Generate sitemap XML
  const lastmod = new Date().toISOString().split("T")[0];
  const entries = urlEntries.map((e) =>
    generateUrlEntry(e.url, e.basePath, e.lang, lastmod)
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${entries.join("\n\n")}

</urlset>
`;

  // Write files
  writeFileSync(resolve(DIST_DIR, "sitemap.xml"), sitemap, "utf-8");
  writeFileSync(resolve(DIST_DIR, "robots.txt"), generateRobotsTxt(), "utf-8");

  // Summary
  const basePaths = new Set(urlEntries.map((e) => e.basePath));
  const docsCount = ENGLISH_ONLY_PATHS.length;
  console.log(`✅ Sitemap generated: dist/sitemap.xml`);
  console.log(`   Total URLs: ${urlEntries.length}`);
  console.log(`   - Static pages: ${urlEntries.length - docsCount}`);
  console.log(`   - Docs pages (English only): ${docsCount}`);
  console.log(`   Base paths: ${Array.from(basePaths).join(", ")}`);
  console.log(`   Languages: ${SUPPORTED_LANGUAGES.join(", ")}`);
  console.log(`✅ robots.txt generated: dist/robots.txt`);
}

main();
