import type React from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LoadingTips } from './LoadingTips';

export type DragValidation = 'none' | 'valid' | 'invalid';

interface DesktopDropZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isProcessing: boolean;
  isDragOver: boolean;
  dragValidation: DragValidation;
  dragBorderClass: string;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

/** Desktop: full drag-and-drop zone with validation feedback */
export function DesktopDropZone({
  fileInputRef,
  isProcessing,
  isDragOver,
  dragValidation,
  dragBorderClass,
  onFileInput,
  onDrop,
  onDragOver,
  onDragLeave,
}: DesktopDropZoneProps) {
  const { t } = useTranslation('upload');

  return (
    <label
      htmlFor="upload-file-input"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        group relative flex cursor-pointer flex-col items-center justify-center rounded-4xl border-4 border-dashed p-8 transition-all duration-500
        focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
        aspect-video
        ${dragBorderClass}
      `}
    >
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

      {isProcessing ? (
        <div className="animate-in fade-in w-full text-center">
          <Loader2
            className="mx-auto mb-6 h-16 w-16 animate-spin text-primary"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white md:text-3xl">
            {t('zone.processing')}
          </h3>
          <p className="font-medium text-zinc-500">{t('zone.processingHint')}</p>
          <LoadingTips isProcessing={isProcessing} />
        </div>
      ) : (
        <div className="text-center">
          {/* Drag validation warning */}
          {isDragOver && dragValidation === 'invalid' && (
            <p className="mb-4 text-sm font-bold text-amber-600 dark:text-amber-400">
              {t('zone.notZipWarning', {
                defaultValue: 'This does not look like a .zip file',
              })}
            </p>
          )}

          {/* Icon */}
          <div
            className={`
              mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-3xl transition-all duration-500
              md:h-24 md:w-24
              ${
                isDragOver
                  ? 'rotate-12 bg-primary text-white'
                  : 'bg-zinc-100 text-zinc-400 group-hover:rotate-6 group-hover:bg-primary group-hover:text-white dark:bg-zinc-800'
              }
            `}
          >
            <Upload size={36} className="md:size-12" aria-hidden="true" />
          </div>

          {/* Upload prompt */}
          <h3 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white md:text-4xl">
            {t('zone.dropHere')}
          </h3>
          <p className="mx-auto mb-8 max-w-sm text-sm font-medium text-zinc-500 md:text-lg">
            {t('zone.orBrowse')}
          </p>
        </div>
      )}
    </label>
  );
}
