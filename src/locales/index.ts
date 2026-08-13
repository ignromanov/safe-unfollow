import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Re-export from shared config (single source of truth)
export {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  RTL_LANGUAGES,
  DEFAULT_LANGUAGE,
  detectLanguageFromUrl,
  type SupportedLanguage,
} from '@/config/languages';

import {
  SUPPORTED_LANGUAGES,
  I18N_NAMESPACES,
  detectLanguageFromUrl,
  type SupportedLanguage,
} from '@/config/languages';
import { loadLanguageResources } from './loadLanguageResources';

// Track initialization state
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Check if i18n is initialized and ready
 */
export function isI18nReady(): boolean {
  return isInitialized;
}

// Subscribers for initialization state
const initSubscribers = new Set<() => void>();

/**
 * Subscribe to i18n initialization
 */
export function subscribeToI18nInit(callback: () => void): () => void {
  initSubscribers.add(callback);
  return () => initSubscribers.delete(callback);
}

/**
 * Notify subscribers when i18n is initialized
 */
function notifyInitSubscribers(): void {
  initSubscribers.forEach(cb => cb());
}

/**
 * Load resources for ALL languages (used during SSG build)
 * This enables synchronous language switching when rendering each page
 */
async function loadAllLanguageResources() {
  const entries = await Promise.all(
    SUPPORTED_LANGUAGES.map(async lang => {
      const resources = await loadLanguageResources(lang);
      return [lang, resources] as const;
    })
  );
  return Object.fromEntries(entries);
}

interface InitI18nOptions {
  /** Whether running in browser (client) or Node.js (SSG build) */
  isClient?: boolean;
}

/**
 * Initialize i18next with language detected from URL
 *
 * Key behavior:
 * - SSG (isClient=false): Loads ALL languages for rendering all pages
 * - Client (isClient=true): Loads only the language from URL
 *
 * During SSG, Layout component calls i18n.changeLanguage() synchronously
 * before rendering each page, which works because all resources are loaded.
 */
export async function initI18n(options?: InitI18nOptions): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  const isClient = options?.isClient ?? typeof window !== 'undefined';

  initPromise = (async () => {
    if (!isClient) {
      // SSG: Load ALL languages for rendering all pages
      // This enables synchronous language switching in Layout
      const allResources = await loadAllLanguageResources();

      await i18n.use(initReactI18next).init({
        resources: allResources,
        lng: 'en', // Default, will be switched per-page in Layout
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: I18N_NAMESPACES,
        interpolation: {
          escapeValue: false,
        },
      });
    } else {
      // Client: Load only the language from URL (lazy loading)
      const urlLang = detectLanguageFromUrl();

      // English is always needed as the fallback bundle and the URL language is needed to
      // render. Awaiting them in sequence made every non-English visitor pay two serial
      // round trips through the same 8-chunk fetch.
      const [enResources, urlResources] = await Promise.all([
        loadLanguageResources('en'),
        urlLang === 'en'
          ? Promise.resolve(null)
          : loadLanguageResources(urlLang).catch(error => {
              console.error(`Failed to load language: ${urlLang}`, error);
              return null;
            }),
      ]);

      const resources: Record<string, typeof enResources> = { en: enResources };
      if (urlResources !== null) resources[urlLang] = urlResources;

      await i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          resources,
          lng: urlLang, // Set language immediately from URL
          fallbackLng: 'en',
          defaultNS: 'common',
          ns: I18N_NAMESPACES,
          interpolation: {
            escapeValue: false,
          },
          detection: {
            // Disable detection - URL is source of truth
            order: [],
            caches: [],
          },
        });
    }

    isInitialized = true;
    notifyInitSubscribers();
  })();

  return initPromise;
}

/**
 * Dynamically load language resources (lazy-loaded for navigation)
 */
export async function loadLanguage(lang: SupportedLanguage): Promise<void> {
  // Ensure i18n is initialized
  await initI18n();

  // Check if language is already loaded
  if (i18n.hasResourceBundle(lang, 'common')) {
    await i18n.changeLanguage(lang);
    return;
  }

  try {
    const resources = await loadLanguageResources(lang);

    // Add resources to i18next
    for (const ns of I18N_NAMESPACES) {
      i18n.addResourceBundle(lang, ns, resources[ns]);
    }

    await i18n.changeLanguage(lang);
  } catch (error) {
    console.error(`Failed to load language: ${lang}`, error);
    await i18n.changeLanguage('en');
  }
}

export default i18n;
