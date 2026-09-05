import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import i18n, { SUPPORTED_LANGUAGES, loadLanguage, type SupportedLanguage } from '@/locales';
import {
  NON_ENGLISH_LANGUAGES,
  getLocaleCode,
  detectLanguageFromPathname,
} from '@/config/languages';
import { INTENT_PATHS } from '@/config/intent-pages';

const BASE_URL = 'https://safeunfollow.app';

/**
 * Updates the HTML lang attribute
 */
function updateHtmlLang(lang: SupportedLanguage): void {
  document.documentElement.lang = lang;
}

/**
 * Removes language prefix from path
 * E.g., /es/upload -> /upload, /ru/ -> /
 */
function getPathWithoutLang(pathname: string): string {
  for (const lang of NON_ENGLISH_LANGUAGES) {
    const prefix = `/${lang}`;
    if (pathname === prefix || pathname === `${prefix}/`) {
      return '/';
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
  }

  return pathname;
}

/**
 * Updates or creates hreflang link tags for SEO.
 * Uses a cached Map to update href in-place instead of removing/recreating DOM elements,
 * reducing DOM mutations and potential layout recalculations.
 */
function updateHreflangTags(currentPath: string, cache: Map<string, HTMLLinkElement>): void {
  const head = document.head;
  const pathWithoutLang = getPathWithoutLang(currentPath);

  // Remove any pre-existing hreflang tags not managed by this hook
  // (e.g., from SSG output or other sources)
  if (cache.size === 0) {
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
  }

  // English-only routes advertise no alternates — in the live DOM as well as in dist/ and in
  // sitemap.xml, because Googlebot reads the rendered DOM. This hook removes as well as adds, so
  // the behaviour here is "clear and add nothing": a bare early return would leave the SSG tags
  // standing on first render and the previous route's ten standing after a client-side navigation.
  //
  // Matched against the full path rather than the locale-stripped one: /ru/<slug> is not one of
  // these routes, it is that locale's NotFoundPage, and it keeps the normal alternates.
  if (INTENT_PATHS.includes(currentPath)) {
    cache.forEach(link => link.remove());
    cache.clear();
    return;
  }

  // All hreflang keys: supported languages + x-default
  const allKeys = [...SUPPORTED_LANGUAGES, 'x-default'] as const;

  for (const key of allKeys) {
    const isXDefault = key === 'x-default';
    const href =
      isXDefault || key === 'en'
        ? `${BASE_URL}${pathWithoutLang}`
        : `${BASE_URL}/${key}${pathWithoutLang}`;

    const existing = cache.get(key);
    if (existing) {
      // Update href in-place (no DOM removal/creation)
      if (existing.href !== href) {
        existing.href = href;
      }
    } else {
      // First time — create and cache the element
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = key;
      link.href = href;
      head.appendChild(link);
      cache.set(key, link);
    }
  }
}

/**
 * Updates Open Graph locale meta tag
 */
function updateOgLocale(lang: SupportedLanguage): void {
  let ogLocale = document.querySelector('meta[property="og:locale"]');
  if (!ogLocale) {
    ogLocale = document.createElement('meta');
    ogLocale.setAttribute('property', 'og:locale');
    document.head.appendChild(ogLocale);
  }
  ogLocale.setAttribute('content', getLocaleCode(lang));
}

/**
 * Updates canonical URL based on current path
 */
function updateCanonical(currentPath: string): void {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', `${BASE_URL}${currentPath}`);
  }
}

/**
 * Hook to sync language from URL path prefix
 *
 * URL is the SINGLE SOURCE OF TRUTH for language.
 *
 * This hook:
 * 1. Detects language from URL
 * 2. Updates store (for persistence/redirect on next visit)
 * 3. Syncs i18next with URL language
 * 4. Updates HTML attributes and SEO meta tags
 *
 * Hreflang link elements are cached in a Map and updated in-place
 * to minimize DOM mutations.
 *
 * IMPORTANT: i18n syncs with URL, NOT with store.
 * Store is only used for persisting preference for future redirects.
 */
export function useLanguageFromPath(langFromRoute?: SupportedLanguage): void {
  const location = useLocation();
  const { setLanguage } = useAppStore();

  // Cache for hreflang link elements to avoid DOM removal/creation
  const linkCacheRef = useRef(new Map<string, HTMLLinkElement>());

  // Detect language from URL (single source of truth)
  const urlLang = langFromRoute ?? detectLanguageFromPathname(location.pathname);

  // Update store when URL language changes (for persistence only)
  useEffect(() => {
    setLanguage(urlLang);
  }, [urlLang, setLanguage]);

  // Sync HTML attributes, meta tags, and i18next with URL language
  useEffect(() => {
    // Defer DOM manipulation to AFTER hydration completes
    // This prevents React from detecting DOM/text mismatches during hydration
    const timeoutId = setTimeout(() => {
      // Update HTML lang attribute
      updateHtmlLang(urlLang);

      // Update hreflang tags for SEO (cached, in-place updates)
      updateHreflangTags(location.pathname, linkCacheRef.current);

      // Update Open Graph locale
      updateOgLocale(urlLang);

      // Update canonical URL
      updateCanonical(location.pathname);
    }, 0);

    // Sync i18next with URL (NOT store!) - this can run immediately
    if (i18n.language !== urlLang) {
      loadLanguage(urlLang);
    }

    return () => clearTimeout(timeoutId);
  }, [urlLang, location.pathname]);
}
