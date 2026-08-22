import { Suspense, lazy, memo, useSyncExternalStore } from 'react';

import {
  getServerExportOpenerSnapshot,
  hasExportOpener,
  openExportDialog,
  subscribeExportOpener,
} from '@/lib/export/export-opener';

// Only ever needed on the one page load that carries a checkout redirect, so it stays
// out of the bundle that all prerendered pages ship.
const LicenseDialog = lazy(() =>
  import('@/components/export/LicenseDialog').then(module => ({ default: module.LicenseDialog }))
);

interface LicenseDialogMountProps {
  licenseKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Owns the Suspense boundary for the license dialog, and nothing else.
 *
 * memo() is load-bearing, not an optimisation. React trips #421 on
 * `didReceiveUpdate || hasContextChanged`, checked per Suspense fiber
 * (react-dom.development.js:20709-20743), and `didReceiveUpdate` fires on a changed
 * props *reference*. JSX allocates a fresh props object on every parent render, so
 * extracting this into a plain child component would isolate nothing — the boundary
 * would still "receive an update" whenever Layout re-rendered for any unrelated reason.
 */
export const LicenseDialogMount = memo(function LicenseDialogMount({
  licenseKey,
  open,
  onOpenChange,
}: LicenseDialogMountProps) {
  // This mount used to pass no `onContinue` at all, and its own prop doc said why:
  // Layout sits above the router outlet and "has no view" to send anyone to. The
  // consequence was that activation ended in a closed sheet for the one reader who
  // had just paid — the manual path, taken by someone who paid days ago, was the
  // only one that offered "Choose a format".
  //
  // Subscribed rather than read once, because the two mounts race: this dialog
  // activates over the network, while the results view registers its opener on its
  // own mount. Either can land first, and a plain read during the first render
  // would decide the label from whichever it was.
  const canContinue = useSyncExternalStore(
    subscribeExportOpener,
    hasExportOpener,
    getServerExportOpenerSnapshot
  );

  return (
    <Suspense fallback={null}>
      <LicenseDialog
        open={open}
        onOpenChange={onOpenChange}
        initialKey={licenseKey}
        source="redirect"
        onContinue={
          canContinue
            ? () => {
                // Closed first: the format dialog is a separate Radix root, and
                // leaving two open would stack a modal over a modal with the
                // focus trap of the one underneath still armed.
                onOpenChange(false);
                openExportDialog();
              }
            : undefined
        }
      />
    </Suspense>
  );
});
