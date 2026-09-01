import { useTranslation } from 'react-i18next';

interface CancelUploadButtonProps {
  isProcessing: boolean;
  /** Absent where the surface has nothing to cancel (ResultsPage). */
  onCancel?: () => void;
}

/**
 * The only way out of a parse that never finishes.
 *
 * The file input is disabled while processing, so a dead worker or a page
 * refreshed mid-parse leaves the reader with a spinner and no control. This
 * renders outside the drop-zone `<label>` on purpose: a button inside it
 * would also activate the input.
 *
 * It guards itself rather than being guarded by its caller — `UploadZone` is
 * at the ESLint complexity limit, and every `&&` in a JSX guard counts
 * against it.
 */
export function CancelUploadButton({ isProcessing, onCancel }: CancelUploadButtonProps) {
  const { t } = useTranslation('upload');

  if (!isProcessing || !onCancel) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onCancel}
      className="mx-auto min-h-11 rounded-xl border border-border px-6 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
    >
      {t('zone.cancelUpload', { defaultValue: 'Cancel upload' })}
    </button>
  );
}
