import type React from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LoadingTips } from './LoadingTips';

interface TouchUploadZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isProcessing: boolean;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Mobile/touch: prominent tap-to-select button with spinner during processing */
export function TouchUploadZone({ fileInputRef, isProcessing, onFileInput }: TouchUploadZoneProps) {
  const { t } = useTranslation('upload');

  return (
    <div className="flex flex-col items-center gap-4">
      <label
        htmlFor="upload-file-input"
        className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98] active:shadow-md"
      >
        <Smartphone size={24} aria-hidden="true" />
        {t('zone.tapToSelect', { defaultValue: 'Tap to select your ZIP file' })}
      </label>
      <input
        ref={fileInputRef}
        id="upload-file-input"
        type="file"
        accept=".zip"
        onChange={onFileInput}
        className="sr-only"
        disabled={isProcessing}
        aria-label={t('zone.ariaLabel')}
      />
      {isProcessing && (
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm font-bold text-zinc-900 dark:text-white">
            {t('zone.processing')}
          </span>
        </div>
      )}
      <LoadingTips isProcessing={isProcessing} />
    </div>
  );
}
