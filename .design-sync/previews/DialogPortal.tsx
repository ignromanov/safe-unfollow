import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'safe-unfollow';

// DialogPortal is purely structural (renders children into document.body via
// Radix Portal) — there is no visual difference from a normal open dialog, so
// these previews are the same full composition DialogContent already wraps in one.

export function PortalledConfirm() {
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

export function PortalledExportChooser() {
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
