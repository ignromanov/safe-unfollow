import { UploadAffiliateBlock } from 'safe-unfollow';

// No props: the offer is resolved internally from i18n.language via
// resolveAffiliateOffer() (config/affiliate-offers.ts). The preview runtime
// fixes the language to English, which resolves to NORDVPN_GLOBAL — the only
// reachable offer here. It has one cut, served at every viewport. The image
// is self-hosted at `/affiliate/nordvpn-v3-1200x628.webp` (public/, real
// path, no hotlinking) — see learnings if it renders broken in the capture.

export function Default() {
  return (
    <div className="max-w-sm">
      <UploadAffiliateBlock />
    </div>
  );
}
