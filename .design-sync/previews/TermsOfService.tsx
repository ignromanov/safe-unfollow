import { TermsOfService } from 'safe-unfollow';

// Long prose page, same rationale as PrivacyPolicy: one story is enough to show the prose
// styling and the amber/rose callout sections. onBack has no visual effect.
export function Default() {
  return <TermsOfService onBack={() => {}} />;
}
