import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from 'safe-unfollow';

// The panel is the axis: how it sizes to a minimal payload versus a dense one.

export function MinimalContent() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this export?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DenseContent() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace your current data?</AlertDialogTitle>
          <AlertDialogDescription>
            Uploading a new export replaces the accounts currently loaded in this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-2xl border border-border bg-muted p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Currently loaded</span>
            <span className="font-bold text-foreground">8,930 accounts</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Source file</span>
            <span className="font-mono text-xs text-foreground">instagram-export.zip</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current data</AlertDialogCancel>
          <AlertDialogAction>Upload new file</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
