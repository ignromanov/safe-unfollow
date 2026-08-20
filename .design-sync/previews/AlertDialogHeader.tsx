import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from 'safe-unfollow';

// The header's grouping is the axis: with the icon well the product uses for
// destructive intent, and without it. Both omit the footer.

export function HeaderWithIcon() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <Trash2 size={28} className="text-rose-500" />
          </div>
          <AlertDialogTitle>Clear all data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all loaded Instagram data and return you to the home screen.
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function HeaderTextOnly() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave the wizard?</AlertDialogTitle>
          <AlertDialogDescription>
            Your progress through the export guide is not saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
