import { PaywallModal } from 'safe-unfollow';

// Real usage: ResultsExportControls opens this only *after* a real sample CSV
// has already been written to disk (Phase 2 — the click delivers a file
// before it asks for anything). The receipt strip at the top names that
// file, so `savedFilename` follows the same `<base><-sample>.csv` pattern
// the component itself builds.
export function Default() {
  return (
    <PaywallModal
      open
      onOpenChange={() => {}}
      onCheckout={() => {}}
      onManualEntry={() => {}}
      savedFilename="instagram-johndoe-20260615-sample.csv"
      totalRows={342}
    />
  );
}

// Same offer, a much larger view — exercises the `toLocaleString` comma
// formatting on the headline ("Get all 48,213.") instead of a two-digit one.
export function LargeDataset() {
  return (
    <PaywallModal
      open
      onOpenChange={() => {}}
      onCheckout={() => {}}
      onManualEntry={() => {}}
      savedFilename="instagram-creator-20260701-sample.csv"
      totalRows={48213}
    />
  );
}
