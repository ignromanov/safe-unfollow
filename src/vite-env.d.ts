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
  /** LemonSqueezy hosted checkout URL for Pro Export. Empty disables the export UI. */
  readonly VITE_LEMONSQUEEZY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
