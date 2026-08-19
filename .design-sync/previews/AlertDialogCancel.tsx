import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogCancel,
} from 'safe-unfollow';

// The cancel button is the axis. The product writes cancels as a restatement of
// the safe outcome rather than the word "Cancel", so both readings are shown.

export function TerseCancel() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OutcomeNamingCancel() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep the 8,930 accounts I already loaded</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
