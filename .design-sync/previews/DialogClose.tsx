import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from 'safe-unfollow';

export function FooterCancelClose() {
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
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Clear data</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomCloseIcon() {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <div className="flex items-start justify-between gap-2">
          <DialogHeader>
            <DialogTitle>Export failed</DialogTitle>
            <DialogDescription>
              Something went wrong while generating the file. Your data was not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              ✕
            </Button>
          </DialogClose>
        </div>
        <DialogFooter>
          <Button>Retry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
