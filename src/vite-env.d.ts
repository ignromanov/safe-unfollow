/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AdSense publisher/client ID (e.g. ca-pub-XXXX). Empty disables all ads. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** AdSense ad unit slot ID for the HomePage in-content placement. */
  readonly VITE_ADSENSE_SLOT_HOME?: string;
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
