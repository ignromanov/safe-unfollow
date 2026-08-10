import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

export function ExportHeader() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Pro Export — $7 one-time</DialogTitle>
          <DialogDescription>
            Download the full unfollowers list as CSV or JSON. Unlocks on up to 3 devices.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Continue to checkout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DestructiveHeader() {
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
