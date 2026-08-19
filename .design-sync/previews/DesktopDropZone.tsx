import { useRef } from 'react';
import { DesktopDropZone } from 'safe-unfollow';

// Desktop drag-and-drop zone. `isDragOver`/`dragValidation`/`dragBorderClass`
// are ordinary props (the parent, UploadZone, computes them from live drag
// events and passes them down) — no synthetic drag events are needed to
// exercise these branches, unlike a CSS `:hover` pseudo-class. The three
// `dragBorderClass` values below are copied verbatim from UploadZone's own
// derivation so the border colour matches what the app actually renders.

export function Idle() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-lg">
      <DesktopDropZone
        fileInputRef={fileInputRef}
        isProcessing={false}
        isDragOver={false}
        dragValidation="none"
        dragBorderClass="border-border bg-card shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-xl"
        onFileInput={() => {}}
        onDrop={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
      />
    </div>
  );
}

export function DragOverValid() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-lg">
      <DesktopDropZone
        fileInputRef={fileInputRef}
        isProcessing={false}
        isDragOver={true}
        dragValidation="valid"
        dragBorderClass="scale-[1.02] border-primary bg-primary/10 shadow-2xl"
        onFileInput={() => {}}
        onDrop={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
      />
    </div>
  );
}

export function DragOverInvalid() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-lg">
      <DesktopDropZone
        fileInputRef={fileInputRef}
        isProcessing={false}
        isDragOver={true}
        dragValidation="invalid"
        dragBorderClass="scale-[1.02] border-amber-500 bg-amber-50 shadow-2xl dark:bg-amber-950/20"
        onFileInput={() => {}}
        onDrop={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
      />
    </div>
  );
}

export function Processing() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-lg">
      <DesktopDropZone
        fileInputRef={fileInputRef}
        isProcessing={true}
        isDragOver={false}
        dragValidation="none"
        dragBorderClass="border-border bg-card shadow-sm"
        onFileInput={() => {}}
        onDrop={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
      />
    </div>
  );
}
