import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from 'safe-unfollow';

// Button arrangement is the axis: the two-action default, and a single
// acknowledge action. No header, so the footer owns the card.

export function TwoActionFooter() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current data</AlertDialogCancel>
          <AlertDialogAction>Upload new file</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SingleActionFooter() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
