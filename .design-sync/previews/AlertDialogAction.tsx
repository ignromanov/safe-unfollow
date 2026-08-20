import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogAction,
} from 'safe-unfollow';

// The action button itself is the axis: the default affirmative against the
// destructive treatment the product uses for data loss.

export function DefaultAction() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogAction>Upload new file</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DestructiveAction() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-rose-500 text-white hover:bg-rose-600">
            Clear Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
