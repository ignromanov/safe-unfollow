import type { ReactNode } from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface ExportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Radix's own X. The paywall draws its own dismiss control — a labelled
   * "Not now" that reads as a choice rather than an escape — and passes false.
   */
  showCloseButton?: boolean;
  children: ReactNode;
}

/**
 * The one container the whole purchase is drawn in: paywall, checkout handoff,
 * licence activation, file download.
 *
 * It exists because those four screens had four geometries — two bottom sheets
 * and two centred `max-w-lg` cards — and nothing told the reader they were one
 * transaction. The geometry below is not new: it is the paywall's, extracted
 * unchanged, because that is the screen whose conversion is measured.
 *
 * Every class string here is load-bearing and was verified against the built
 * CSS rather than assumed. `max-sm:translate-y-0` cancels the base dialog's
 * centring so the sheet can weld to the bottom edge; `zoom-in-100` and
 * `fade-in-100` cancel the inherited scale and opacity terms, because
 * tw-animate composes a single `enter` keyframe and a term is removed by
 * setting it to its identity, not by omitting it. `overlayClassName` exists
 * because Radix gives Overlay and Content separate `Presence` instances and
 * synchronises nothing: without it a 300ms sheet finishes over a scrim that
 * left at 150ms.
 */
export function ExportSheet({
  open,
  onOpenChange,
  showCloseButton = true,
  children,
}: ExportSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        overlayClassName="max-sm:duration-300 max-sm:ease-out"
        className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:border-b-0 max-sm:max-h-[90dvh] max-sm:overflow-y-auto max-sm:px-5 max-sm:pb-[calc(1.75rem+env(safe-area-inset-bottom))] max-sm:shadow-[0_-8px_30px_oklch(0_0_0/0.12)] max-sm:duration-300 max-sm:ease-out max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:fade-in-100 max-sm:data-[state=closed]:fade-out-100"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
