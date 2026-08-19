import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

export function ClearDataConfirm() {
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

export function ExportPaywall() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Pro Export — $7 one-time</DialogTitle>
          <DialogDescription>
            Download the full unfollowers list as CSV or JSON. Not a subscription, no hidden costs,
            unlocks on up to 3 devices.
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

export function LicenseActivation() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate your license</DialogTitle>
          <DialogDescription>
            Paste the license key from your purchase receipt to unlock exports on this device.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Activate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
