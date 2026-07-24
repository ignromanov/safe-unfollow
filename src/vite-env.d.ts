/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NordVPN affiliate URL. Unset (or empty) hides the affiliate loading tip. */
  readonly VITE_NORDVPN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
