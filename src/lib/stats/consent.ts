import { TRACKING_OPT_OUT_KEY } from './constants';

/**
 * Whether the visitor has opted out of analytics.
 *
 * Lives in its own module because both the event queue and the opt-out control
 * need it, and having them import each other would be a cycle.
 */
export function isTrackingOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TRACKING_OPT_OUT_KEY) === 'true';
}
