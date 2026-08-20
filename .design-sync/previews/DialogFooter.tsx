import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

export function TwoActionFooter() {
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

export function SingleActionFooter() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>License activated</DialogTitle>
          <DialogDescription>
            This device can now export the full list as CSV or JSON, any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
