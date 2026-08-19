import { PrivacyPolicy } from 'safe-unfollow';

// Long prose page — the point is that the prose styling (headings, lists, the emerald/primary
// callout boxes) is visible, not a props matrix. onBack has no visual effect.
export function Default() {
  return <PrivacyPolicy onBack={() => {}} />;
}
