import type { SupportedLanguage } from '@/config/languages';

import { AnalyticsEvents } from './constants';
import { trackBeacon, trackEvent } from './core';

/**
 * `locale_hint_view`, `locale_hint_click` and `locale_hint_dismiss`.
 *
 * The dismissal is sent as an event and only on an explicit Close: a tab closed without a
 * choice is not a dismissal. lumen-cro's rollback rule (dismiss > 80% and CTR < 5% over 14
 * days) needs it as a denominator. What is never sent is the remembered dismissal itself,
 * which stays in localStorage on the device (velum-cdpo, 2026-11-16).
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
  dismiss: (targetLang: SupportedLanguage, path: string) => {
    trackEvent(AnalyticsEvents.LOCALE_HINT_DISMISS, { target_lang: targetLang, path });
  },
};
