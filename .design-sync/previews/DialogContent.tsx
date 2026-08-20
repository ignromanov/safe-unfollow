import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

export function ConfirmContent() {
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

export function FormatChooserContent() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a file format</DialogTitle>
          <DialogDescription>
            Both formats include every account matching your current filters.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="justify-start">
            CSV — opens in Excel or Sheets
          </Button>
          <Button variant="outline" className="justify-start">
            JSON — for scripts and re-import
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorStateContent() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export failed</DialogTitle>
          <DialogDescription>
            Something went wrong while generating the file. Your data was not affected — try again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Retry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
