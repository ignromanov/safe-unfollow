import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

// DialogOverlay has no standalone visual — shadcn's DialogContent already renders it
// internally (bg-black/50, fixed inset-0) as the dimmed backdrop behind the content.
// These previews show it the only honest way: as part of a full open dialog.

export function BackdropWithConfirm() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all analyzed data?</DialogTitle>
          <DialogDescription>
            This removes the parsed export from this browser. Your Instagram account is not
            affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Clear data</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BackdropWithPaywall() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Pro Export — $7 one-time</DialogTitle>
          <DialogDescription>
            Download the full unfollowers list as CSV or JSON. Not a subscription, unlocks on up to
            3 devices.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Already purchased? Enter your key</Button>
          <Button>Continue to checkout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
