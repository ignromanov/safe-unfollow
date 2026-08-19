import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'safe-unfollow';

// The overlay only means something against content it dims, so both cells put a
// real results list behind it. The axis is how much page shows through.

function BackdropContent() {
  return (
    <div className="space-y-2 p-6">
      <h2 className="font-display text-2xl font-extrabold text-foreground">Your accounts</h2>
      {['@mira.codes', '@lens.and.light', '@quietmornings', '@atlas.runs', '@softfocus'].map(u => (
        <div
          key={u}
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
        >
          <span className="text-sm font-medium text-foreground">{u}</span>
          <span className="rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-black uppercase tracking-widest text-rose-500">
            Unfollowed
          </span>
        </div>
      ))}
    </div>
  );
}

export function OverlayOverResults() {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-border">
      <BackdropContent />
      <AlertDialog open>
        <AlertDialogPortal>
          <AlertDialogOverlay />
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  );
}

export function OverlayBehindDialog() {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-border">
      <BackdropContent />
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
