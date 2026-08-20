import { FooterCTA } from 'safe-unfollow';

// Real usage from Layout.tsx: the closing section below FAQ, mirroring
// Hero's primary/secondary pair one more time before the reader leaves the
// page. No variant prop exists — onStart/onSample only decide navigation.
export function Default() {
  return <FooterCTA onStart={() => {}} onSample={() => {}} />;
}
