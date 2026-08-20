import { useRef } from 'react';
import { TouchUploadZone } from 'safe-unfollow';

// Mobile tap-to-select CTA. `fileInputRef` is required by the real component
// (it owns the hidden <input type="file">) but has no visual effect here —
// a plain useRef stands in for the parent's ref in real usage.

export function Idle() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-sm">
      <TouchUploadZone fileInputRef={fileInputRef} isProcessing={false} onFileInput={() => {}} />
    </div>
  );
}

export function Processing() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-sm">
      <TouchUploadZone fileInputRef={fileInputRef} isProcessing={true} onFileInput={() => {}} />
    </div>
  );
}
