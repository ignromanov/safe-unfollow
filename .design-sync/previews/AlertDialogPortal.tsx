import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from 'safe-unfollow';

// The portal's whole job is escaping a clipping ancestor, so the card shows one:
// a short overflow-hidden box that the dialog visibly renders outside of.

export function EscapesClippedParent() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
        Parent below is 96px tall with overflow-hidden
      </p>
      <div className="h-24 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Clipping ancestor. Without the portal the dialog would be cropped to this box.
        </p>
        <AlertDialog open>
          <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rendered at the document root</AlertDialogTitle>
                <AlertDialogDescription>
                  Portalled out of the dashed box above, so neither its height nor its overflow rule
                  applies here.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
      </div>
    </div>
  );
}
