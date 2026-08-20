import { Dialog, DialogTrigger, Button } from 'safe-unfollow';

// DialogTrigger renders as a plain button whether or not the dialog is open —
// it only needs Dialog's context, so these stay closed and show the trigger itself.

export function ExportButtonTrigger() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Export · $7</Button>
      </DialogTrigger>
    </Dialog>
  );
}

export function EnterKeyLinkTrigger() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link">Already purchased? Enter your key</Button>
      </DialogTrigger>
    </Dialog>
  );
}
