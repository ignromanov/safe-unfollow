import { UploadAffiliateBlock } from 'safe-unfollow';

// No props: the offer is resolved internally from i18n.language via
// resolveAffiliateOffer() (config/affiliate-offers.ts). The preview runtime
// fixes the language to English, which resolves to NORDVPN_GLOBAL — the only
// reachable offer here. Its `wide` (970x250, `lg:` and up) creative also
// cannot be reached: the capture viewport is 900px wide, below the 1024px
// breakpoint, so only the `base` (300x250) cut ever renders. The image is
// self-hosted at `/affiliate/nordvpn-v2-300x250.webp` (public/, real path,
// no hotlinking) — see learnings if it renders broken in the capture.

export function Default() {
  return (
    <div className="max-w-sm">
      <UploadAffiliateBlock />
    </div>
  );
}
