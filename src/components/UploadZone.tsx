import type { DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { ALL_DIAGNOSTIC_ERROR_CODES, createDiagnosticError } from '@/core/types';
import { analytics } from '@/lib/analytics';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { DiagnosticErrorScreen } from './DiagnosticErrorScreen';
import { TouchUploadZone } from './upload/TouchUploadZone';
import { DesktopDropZone } from './upload/DesktopDropZone';
import { DevErrorSelector } from './upload/DevErrorSelector';
import { LoadingTips } from './upload/LoadingTips';
import { FormatQuiz } from './upload/FormatQuiz';
import { UploadAffiliateBlock } from './upload/UploadAffiliateBlock';

import type { DragValidation } from './upload/DesktopDropZone';

export interface UploadZoneProps {
  onUploadStart: (file: File) => void;
  onOpenWizard?: (code?: DiagnosticErrorCode) => void;
  isProcessing?: boolean;
  parseWarnings?: ParseWarning[];
}

export function UploadZone({
  onUploadStart,
  onOpenWizard,
  isProcessing = false,
  parseWarnings,
}: UploadZoneProps) {
  const { t } = useTranslation('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragValidation, setDragValidation] = useState<DragValidation>('none');
  const [showDiagnostic, setShowDiagnostic] = useState(true);
  const isTouchDevice = useIsTouchDevice();

  // Dev mode: preview any error state
  const [devErrorCode, setDevErrorCode] = useState<DiagnosticErrorCode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if we have a critical error that should show diagnostic screen
  const hasCriticalError = useMemo(() => {
    if (!parseWarnings?.length) return false;
    return parseWarnings.some(w => w.severity === 'error');
  }, [parseWarnings]);

  // Generate mock warnings for dev preview
  const devParseWarnings = useMemo(() => {
    if (!import.meta.env.DEV || !devErrorCode) return null;

    const diagnostic = createDiagnosticError(devErrorCode);
    return [
      {
        code: devErrorCode,
        message: diagnostic.message,
        severity: diagnostic.severity,
        fix: diagnostic.fix,
      },
    ] as ParseWarning[];
  }, [devErrorCode]);

  // Use dev warnings if in dev preview mode
  const effectiveWarnings = devParseWarnings ?? parseWarnings;
  const effectiveHasCriticalError = devParseWarnings ? true : hasCriticalError;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);

    // Validate dragged file type via dataTransfer.items
    const items = e.dataTransfer.items;
    if (items.length > 0) {
      const item = items[0];
      const isZipType =
        item?.type === 'application/zip' ||
        item?.type === 'application/x-zip-compressed' ||
        item?.type === 'application/octet-stream';
      // dataTransfer.items may not expose type for all files, so treat empty type as unknown (valid)
      setDragValidation(item?.type && !isZipType ? 'invalid' : 'valid');
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDragValidation('none');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setDragValidation('none');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        onUploadStart(file);
      }
    },
    [onUploadStart]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        analytics.uploadClick();
        onUploadStart(file);
      }
    },
    [onUploadStart]
  );

  const handleTryAgain = useCallback(() => {
    if (devErrorCode) {
      // Dev mode: reset to upload zone
      setDevErrorCode(null);
    }
    setShowDiagnostic(false);
  }, [devErrorCode]);

  // Show diagnostic error screen for critical errors (or dev preview)
  if (effectiveHasCriticalError && showDiagnostic && !isProcessing) {
    return (
      <>
        <DiagnosticErrorScreen
          parseWarnings={effectiveWarnings}
          onTryAgain={handleTryAgain}
          onOpenWizard={onOpenWizard}
        />

        {/* Dev mode: Error selector overlay */}
        {import.meta.env.DEV && (
          <DevErrorSelector
            currentCode={devErrorCode}
            onSelect={setDevErrorCode}
            onClose={() => setDevErrorCode(null)}
          />
        )}
      </>
    );
  }

  // Compute drag border color based on file type validation
  const dragBorderClass =
    isDragOver && dragValidation === 'invalid'
      ? 'scale-[1.02] border-amber-500 bg-amber-50 shadow-2xl dark:bg-amber-950/20'
      : isDragOver
        ? 'scale-[1.02] border-primary bg-primary/10 shadow-2xl'
        : 'border-border bg-card shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-xl';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-24">
      {/* Format quiz — non-blocking card above upload zone */}
      <FormatQuiz onOpenWizard={onOpenWizard} isProcessing={isProcessing} />

      {/* Screen reader announcement for upload status */}
      <div role="status" aria-live="polite" className="sr-only">
        {isProcessing &&
          t('zone.processingAria', { defaultValue: 'Processing your file, please wait...' })}
      </div>

      <div className="grid gap-12 lg:grid-cols-5">
        {/* Main upload area - 3 columns */}
        <div className="flex flex-col gap-8 lg:col-span-3">
          {/* Title */}
          <div className="text-center md:text-start">
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-6xl">
              {t('zone.title')}
            </h1>
            <p className="text-base font-medium text-zinc-500 md:text-lg">
              {t('zone.description')}
            </p>
          </div>

          {/* JSON format reminder — inline hint, no card chrome */}
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 md:text-sm">
            <Info size={14} className="me-1.5 inline shrink-0 text-zinc-400" aria-hidden="true" />
            {t('zone.jsonReminder', {
              defaultValue:
                'Make sure you selected JSON format when requesting your data export. JSON and HTML ZIP files look identical from the outside.',
            })}
            {onOpenWizard && (
              <>
                {' '}
                <button
                  onClick={() => onOpenWizard?.()}
                  className="inline font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {t('zone.seeGuide', { defaultValue: 'See the step-by-step guide' })}
                </button>
              </>
            )}
          </p>

          {/* Upload zone: touch-optimized vs desktop drag-and-drop */}
          {isTouchDevice ? (
            <TouchUploadZone
              fileInputRef={fileInputRef}
              isProcessing={isProcessing}
              onFileInput={handleFileInput}
            />
          ) : (
            <DesktopDropZone
              fileInputRef={fileInputRef}
              isProcessing={isProcessing}
              isDragOver={isDragOver}
              dragValidation={dragValidation}
              dragBorderClass={dragBorderClass}
              onFileInput={handleFileInput}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          )}

          {/* Sibling of the drop zone: the desktop zone is a <label>, which
              cannot legally contain the affiliate link, and its fixed
              aspect-ratio box has no room for the cards. */}
          <LoadingTips isProcessing={isProcessing} />

          {/* Mobile-only: compact help section (replaces sidebar cards) */}
          <div className="mt-4 space-y-2 text-center lg:hidden">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {t('zone.privacyMicro', {
                defaultValue: 'Your file never leaves your device',
              })}
            </p>
            {onOpenWizard && (
              <button
                onClick={() => onOpenWizard?.()}
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {t('zone.notSureLink', {
                  defaultValue: 'Not sure what to upload? See the guide',
                })}
              </button>
            )}
          </div>

          {/* Last in the column on purpose: the drop zone above is an
              interaction target, and the help block plus the parent's gap-8
              keep real distance from it. */}
          <UploadAffiliateBlock />
        </div>

        {/* Sidebar - desktop only; hidden on mobile to keep CTA visible without scroll */}
        <div className="hidden space-y-6 lg:block lg:col-span-2">
          {/* Pre-upload Checklist */}
          <div className="rounded-4xl border border-border bg-card p-8 shadow-sm">
            <h4 className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />{' '}
              {t('checklist.title')}
            </h4>
            <ul className="space-y-5">
              {[
                t('checklist.format'),
                t('checklist.includes'),
                t('checklist.timeframe'),
                t('checklist.fileType'),
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Most Common Error */}
          <div className="rounded-4xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              <Info size={16} className="text-primary" aria-hidden="true" />{' '}
              {t('errors.commonTitle')}
            </h4>
            <p className="text-xs font-medium leading-relaxed text-zinc-500 md:text-sm">
              <Trans i18nKey="errors.commonHint" ns="upload" components={{ strong: <strong /> }} />
            </p>
            {onOpenWizard && (
              <button
                onClick={() => onOpenWizard?.()}
                className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:underline"
              >
                {t('errors.learnFix')}{' '}
                <ArrowLeft className="rotate-180" size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dev mode: Show error preview button */}
      {import.meta.env.DEV && !devErrorCode && (
        <div className="fixed bottom-4 start-4 z-50">
          <button
            onClick={() => setDevErrorCode('NOT_ZIP')}
            className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-4 py-2 text-xs font-medium text-zinc-400 shadow-xl backdrop-blur transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            🔧 Dev: Preview Errors ({ALL_DIAGNOSTIC_ERROR_CODES.length})
          </button>
        </div>
      )}
    </div>
  );
}
