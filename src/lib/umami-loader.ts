/**
 * Umami Analytics Loader
 *
 * Loads Umami analytics script dynamically with user opt-out support.
 * Respects user privacy preferences via localStorage.
 */

export function loadUmami(): void {
  // Respect user opt-out
  if (typeof localStorage !== 'undefined' && localStorage.getItem('umami-opt-out') === 'true') {
    return;
  }

  // Only load in browser
  if (typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://umami-coral-xi.vercel.app/script.js';
  script.dataset.websiteId = 'f204b58f-a5bb-4231-b02b-4cc05f472d02';
  document.head.appendChild(script);
}
