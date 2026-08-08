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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
