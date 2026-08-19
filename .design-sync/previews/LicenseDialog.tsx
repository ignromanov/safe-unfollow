import { LicenseDialog } from 'safe-unfollow';

// Real usage: PaywallModal's "Already purchased? Enter your key" link opens
// this with no key in hand — the manual-entry form, second-device recovery
// path.
export function ManualEntry() {
  return <LicenseDialog open onOpenChange={() => {}} initialKey={null} source="manual" />;
}

// Real usage: the post-checkout redirect carries `?license_key=…` and this
// dialog activates it automatically on mount (`source="redirect"`). This
// preview build has no `VITE_DODO_CHECKOUT_URL` configured, so
// `activateLicense` resolves through its "unconfigured" branch instantly —
// no network round-trip is ever attempted — and the component settles on the
// generic-failure + retry state well before any screenshot is taken. That is
// a real, reachable state of the shipped component (the same copy a genuine
// network failure produces), not a fabricated one.
export function ActivationFailed() {
  return (
    <LicenseDialog
      open
      onOpenChange={() => {}}
      initialKey="38b1460a-5104-4067-a91d-77b872934d51"
      source="redirect"
    />
  );
}
