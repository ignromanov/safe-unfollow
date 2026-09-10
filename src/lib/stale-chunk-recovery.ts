/**
 * Recovery from a chunk the deploy removed while this tab was open.
 *
 * Every chunk filename carries a content hash. A tab loaded before a deploy holds the old
 * manifest, so its next dynamic import asks for a filename that no longer exists on the origin,
 * and the import rejects. The reader sees it wherever the lazy boundary is — for the events
 * that got GH#103 filed, that was the paywall, because a lazy chunk is only fetched when
 * somebody asks for it and asking to pay is when they ask.
 *
 * Retrying the import cannot fix it, and the reasoning is written out in full at the top of
 * src/pages/UploadPage.tsx: the browser's module map records the failed fetch against the
 * (url, type) pair, so a second `import()` of the same specifier settles from the map without a
 * request going out, and React's `lazyInitializer` never re-runs a factory whose payload has
 * already rejected. A reload is the only thing that gets a new manifest, and Vite provides the
 * hook for exactly this: `vite:preloadError`, dispatched from its preload helper around the
 * failing import itself.
 *
 * A reload is safe to attempt because the service worker serves documents NetworkFirst
 * (vite/pwa-config.ts), so the reloaded document comes from the network and names the chunks
 * that now exist. It is not safe to attempt twice: when the network is what failed, Workbox
 * falls back to the week-long `pages-cache` and the same stale document comes back, naming the
 * same dead chunk. Hence one attempt per tab, and then the failure is left to surface.
 */
const RELOAD_MARKER = 'stale-chunk-reload';

/**
 * Two guards, because they cover different lifetimes. The module variable is what stops a
 * second dead chunk in the same page from queueing a second reload; it dies with the page.
 * `sessionStorage` is what survives the reload, which is the case that would otherwise loop —
 * reload, fail identically, reload again.
 */
let reloadAttempted = false;

function alreadyAttempted(): boolean {
  if (reloadAttempted) return true;
  try {
    return sessionStorage.getItem(RELOAD_MARKER) !== null;
  } catch {
    // Storage refused (a browser blocking site data, a hardened privacy mode). That is a
    // degraded state, which is where this recovery matters most, so the reload still happens —
    // with only the in-page guard behind it.
    return false;
  }
}

function rememberAttempt(): void {
  reloadAttempted = true;
  try {
    sessionStorage.setItem(RELOAD_MARKER, '1');
  } catch {
    // See alreadyAttempted: the in-page guard stands alone rather than the attempt being
    // abandoned.
  }
}

/**
 * Install before anything that can dynamically import — including `initI18n`, whose locale
 * bundles are dynamic imports too.
 *
 * The event is deliberately not cancelled. Vite rethrows the failure unless a listener calls
 * `preventDefault()`, and that rethrow is what reaches ErrorBoundary and gets reported through
 * `analytics.errorBoundary` — the only instrument that has ever measured this failure. Silencing
 * it would trade a measured problem for an unmeasured one.
 */
export function installStaleChunkRecovery(): void {
  window.addEventListener('vite:preloadError', () => {
    // Checked before the guard, not after, so declining here does not spend the one attempt: a
    // reload cannot fetch what the network is withholding, and Workbox would answer the
    // navigation out of `pages-cache` with the same document naming the same dead chunk.
    if (navigator.onLine === false) return;
    if (alreadyAttempted()) return;
    rememberAttempt();
    window.location.reload();
  });
}
