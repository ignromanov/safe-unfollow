/**
 * UTM parameter capture and entry CTA attribution.
 */

const UTM_STORAGE_KEY = 'analytics_utm';
const ENTRY_CTA_KEY = 'analytics_entry_cta';

/**
 * Capture UTM parameters from URL on page load.
 * Store in sessionStorage for enriching events later.
 */
export function captureUTMParams(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  for (const key of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

export function getStoredUTM(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Store entry CTA for conversion attribution.
 * Called from Hero CTA handlers.
 */
export function setEntryCTA(cta: string): void {
  if (typeof window === 'undefined') return;
  // Only store the first CTA per session
  if (!sessionStorage.getItem(ENTRY_CTA_KEY)) {
    sessionStorage.setItem(ENTRY_CTA_KEY, cta);
  }
}

export function getEntryCTA(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ENTRY_CTA_KEY);
}
