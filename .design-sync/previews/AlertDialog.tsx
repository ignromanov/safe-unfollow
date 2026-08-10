import { Trash2, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from 'safe-unfollow';

// Ported from src/components/Header.tsx — the only AlertDialog usage in the app:
// the "Delete Data" control in the header, which clears everything from IndexedDB.
export function ClearDataConfirm() {
  return (
    <AlertDialog open>
      <AlertDialogTrigger asChild>
        <button className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all">
          <Trash2 size={18} />
          <span>Delete Data</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-2">
            <Trash2 size={28} className="text-rose-500" />
          </div>
          <AlertDialogTitle>Clear all data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all loaded Instagram data and return you to the home screen. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-rose-500 text-white hover:bg-rose-600">
            Clear Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Plausible second scenario for the same upload flow: re-uploading a ZIP while
// a previous export is already loaded would silently replace it in IndexedDB.
export function ReplaceDataConfirm() {
  return (
    <AlertDialog open>
      <AlertDialogTrigger asChild>
        <button className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold">
          Upload a new export
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
            <RefreshCw size={28} className="text-muted-foreground" />
          </div>
          <AlertDialogTitle>Replace your current data?</AlertDialogTitle>
          <AlertDialogDescription>
            Uploading a new export will replace the accounts currently loaded in this browser.
            Export your current results first if you want to keep them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current data</AlertDialogCancel>
          <AlertDialogAction>Upload new file</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
