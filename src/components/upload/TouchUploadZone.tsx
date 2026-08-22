import type React from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TouchUploadZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isProcessing: boolean;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Mobile/touch: prominent tap-to-select button that becomes its own progress indicator */
export function TouchUploadZone({ fileInputRef, isProcessing, onFileInput }: TouchUploadZoneProps) {
  const { t } = useTranslation('upload');

  return (
    <>
      {/* min-h-24 is the height the idle label already occupies at 390px in the
          long locales (two lines of text-lg inside py-5). Pinning it keeps the
          box the same size when the label collapses to the one-line busy
          string, so the offer below the button does not jump at parse start. */}
      <label
        htmlFor="upload-file-input"
        aria-busy={isProcessing}
        className={`relative flex min-h-24 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-lg transition-all ${
          isProcessing
            ? 'pointer-events-none'
            : 'cursor-pointer active:scale-[0.98] active:shadow-md'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-6 w-6 shrink-0 animate-spin" aria-hidden="true" />
            {t('zone.processing')}
            {/* Indeterminate on purpose: parsing emits no progress events, so a
                filling bar would be inventing a number. This only says "still
                working", which is the one thing we actually know. */}
            <span
              className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-primary-foreground/15"
              aria-hidden="true"
            >
              <span className="block h-full w-2/5 animate-upload-sweep rounded-full bg-primary-foreground/55" />
            </span>
          </>
        ) : (
          <>
            <Smartphone size={24} className="shrink-0" aria-hidden="true" />
            {t('zone.tapToSelect', { defaultValue: 'Tap to select your ZIP file' })}
          </>
        )}
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
    </>
  );
}
