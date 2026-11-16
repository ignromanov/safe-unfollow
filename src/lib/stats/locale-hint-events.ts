import type { SupportedLanguage } from '@/config/languages';

import { AnalyticsEvents } from './constants';
import { trackBeacon, trackEvent } from './core';

/**
 * `locale_hint_view` and `locale_hint_click`, and deliberately nothing for a dismissal
 * (velum-cdpo, 2026-11-16: closing the hint is the reader saying no, and stays on the device).
 *
 * Two fields, both bounded: `target_lang` is a SUPPORTED_LANGUAGES member by construction
 * (`translationTarget` returns nothing else), and `path` is `location.pathname` alone, never
 * the query or the hash. Not on the entry-chunk `analytics` object: only the lazy hint chunk
 * calls these.
 */
export const localeHintTelemetry = {
  view: (targetLang: SupportedLanguage, path: string) => {
    trackEvent(AnalyticsEvents.LOCALE_HINT_VIEW, { target_lang: targetLang, path });
  },
  /** A beacon: the click starts a navigation that would otherwise cancel the request. */
  click: (targetLang: SupportedLanguage, path: string) => {
    trackBeacon(AnalyticsEvents.LOCALE_HINT_CLICK, { target_lang: targetLang, path });
  },
};
