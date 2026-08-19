import { InlineDonationCard } from 'safe-unfollow';

// Reads useTranslation('results') for every string (headline/body/cta/dismiss)
// with no fallback text in the component itself — see learnings if this
// renders raw i18n keys or throws without an i18n provider.
export function Default() {
  return (
    <div className="max-w-2xl">
      <InlineDonationCard accountCount={1530} />
    </div>
  );
}
