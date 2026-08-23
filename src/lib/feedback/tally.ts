/**
 * Tally feedback form loader.
 *
 * Tally's documented integration (`<head>` snippet, `data-tally-open`,
 * `#tally-open=`) all bind at script-load time, so any of them requires
 * `embed.js` on every page load — including the ~144 prerendered locale pages
 * where there is nothing to click. This loader injects the script only when
 * the visitor actually opens the feedback form, following the same
 * id-guarded injection shape as `src/lib/ads/loader.ts` and
 * `src/lib/umami-loader.ts`: nothing reaches Tally until the click.
 */

/** Id of the injected script tag; used to keep injection idempotent. */
const TALLY_SCRIPT_ID = 'tally-embed-js';

export const TALLY_FORM_ID = 'PdZ61B';

declare global {
  interface Window {
    Tally?: {
      openPopup?: (formId: string, options?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Fields sent with every form open. Exactly the three velum-cdpo approved —
 * never widened by a spread or a loop over keys, so an added field fails a
 * key-set test rather than passing silently.
 */
export interface FeedbackContext {
  locale: string;
  page: string;
  version: string;
}

/** Inject `embed.js` once. No-op if the tag is already present. */
function ensureTallyScript(): Promise<void> {
  const existing = document.getElementById(TALLY_SCRIPT_ID);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = TALLY_SCRIPT_ID;
    script.async = true;
    script.src = 'https://tally.so/widgets/embed.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Tally embed script'));
    document.head.appendChild(script);
  });
}

/**
 * Injects `embed.js` once, awaits load, and opens the feedback popup with the
 * given hidden fields. Rejects if the script fails to load or `Tally.openPopup`
 * is unavailable after load — the caller decides how to surface that, rather
 * than this module swallowing it into a no-op that reports nothing.
 */
export async function openFeedbackForm(ctx: FeedbackContext): Promise<void> {
  if (typeof document === 'undefined') return;

  await ensureTallyScript();

  if (!window.Tally?.openPopup) {
    throw new Error('Tally.openPopup is unavailable after script load');
  }

  window.Tally.openPopup(TALLY_FORM_ID, {
    layout: 'modal',
    width: 500,
    hiddenFields: { locale: ctx.locale, page: ctx.page, version: ctx.version },
  });
}
