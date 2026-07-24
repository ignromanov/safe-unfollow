/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AdSense publisher/client ID (e.g. ca-pub-XXXX). Empty disables all ads. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** AdSense ad unit slot ID for the HomePage placement. */
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  /** AdSense ad unit slot ID for the Results placement. */
  readonly VITE_ADSENSE_SLOT_RESULTS?: string;
  /** Dev-only override to render ads locally without a geo cookie ('1' to enable). */
  readonly VITE_ADSENSE_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
