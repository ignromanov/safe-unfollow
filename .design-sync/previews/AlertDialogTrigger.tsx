import { Trash2, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogTrigger } from 'safe-unfollow';

// The trigger is the subject, so both cells leave the dialog CLOSED — an open
// dialog would cover the very element these cards exist to show. Each trigger
// sits in the toolbar row it actually ships in, because a bare button floating
// in an empty card reads as a broken preview rather than as a component.

export function DeleteDataTrigger() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="font-display text-lg font-extrabold tracking-tight text-foreground">
          instagram-export.zip
        </p>
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          8,930 accounts · loaded locally
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50">
            <Trash2 size={18} />
            <span>Delete Data</span>
          </button>
        </AlertDialogTrigger>
      </AlertDialog>
    </div>
  );
}

export function UploadNewFileTrigger() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-muted px-5 py-4">
      <p className="text-sm text-muted-foreground">
        Analysed a newer export? Replace the data in this browser.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-all hover:shadow-xl">
            <Upload size={18} />
            <span>Upload a new export</span>
          </button>
        </AlertDialogTrigger>
      </AlertDialog>
    </div>
  );
}
