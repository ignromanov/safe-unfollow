import { Suspense, lazy, memo } from 'react';

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
  return (
    <Suspense fallback={null}>
      <LicenseDialog
        open={open}
        onOpenChange={onOpenChange}
        initialKey={licenseKey}
        source="redirect"
      />
    </Suspense>
  );
});
