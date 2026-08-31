/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AdSense publisher/client ID (e.g. ca-pub-XXXX). Empty disables all ads. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** AdSense ad unit slot ID for the HomePage in-content placement. */
  /** AdSense ad unit slot ID for the Results placement. */
  readonly VITE_ADSENSE_SLOT_RESULTS?: string;
  /** AdSense ad unit slot ID for the low-profile unit at the end of Results. */
  readonly VITE_ADSENSE_SLOT_RESULTS_END?: string;
  /**
   * Dodo Payments checkout URL for Pro Export. Empty disables the export UI.
   * Its hostname also selects the License API mode: a `test.` host routes
   * activation to test.dodopayments.com (see lib/export/license.ts).
   */
  readonly VITE_DODO_CHECKOUT_URL?: string;
  /**
   * Where the Umami tracker is loaded from. Defaults to the same-origin proxy
   * `/v/script.js` (see `vercel.json` rewrites). Set to an absolute URL only to
   * point at an instance that is not proxied. GH#63.
   */
  readonly VITE_UMAMI_SRC?: string;
  /** Umami website id events are attributed to. GH#63. */
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  /**
   * Where the Umami heatmap recorder is loaded from. Defaults to the same-origin
   * proxy `/v/recorder.js`, the same rewrite that serves the tracker. GH#95.
   */
  readonly VITE_UMAMI_RECORDER_SRC?: string;
  /**
   * Base the recorder resolves `/api/record` and its config endpoint against.
   * Defaults to the `/v` proxy prefix. GH#95.
   */
  readonly VITE_UMAMI_HOST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build version, inlined by `define` in vite.config.ts: the short commit sha in
 * Vercel builds, `package.json`'s version otherwise. Used as the Tally feedback
 * form's `version` hidden field (src/lib/feedback/tally.ts) — never per-user.
 */
declare const __APP_VERSION__: string;
