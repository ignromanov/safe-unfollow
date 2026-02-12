'use client';

import type { DiagnosticErrorCode, ParseWarning } from '@/core/types';
import { ALL_DIAGNOSTIC_ERROR_CODES, createDiagnosticError } from '@/core/types';
import { analytics } from '@/lib/analytics';
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, Upload } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { DiagnosticErrorScreen } from './DiagnosticErrorScreen';

export interface UploadError {
  title: string;
  message: string;
}

export interface UploadZoneProps {
  onUploadStart: (file: File) => void;
  onBack?: () => void;
  onOpenWizard?: () => void;
  isProcessing?: boolean;
  error?: UploadError | string | null;
  parseWarnings?: ParseWarning[];
}

export function UploadZone({
  onUploadStart,
  onBack,
  onOpenWizard,
  isProcessing = false,
  error: _error,
  parseWarnings,
}: UploadZoneProps) {
  const { t } = useTranslation('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(true);

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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
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
          onBack={onBack}
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-24">
      {/* Screen reader announcement for upload status */}
      <div role="status" aria-live="polite" className="sr-only">
        {isProcessing &&
          t('zone.processingAria', { defaultValue: 'Processing your file, please wait...' })}
      </div>

      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 transition-colors hover:text-primary md:mb-12"
        >
          <ArrowLeft size={18} /> {t('zone.back')}
        </button>
      )}

      <div className="grid gap-12 lg:grid-cols-5">
        {/* Main upload area - 3 columns */}
        <div className="space-y-8 lg:col-span-3">
          {/* Title */}
          <div className="text-center md:text-left">
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-6xl">
              {t('zone.title')}
            </h1>
            <p className="text-base font-medium text-zinc-500 md:text-lg">
              {t('zone.description')}
            </p>
          </div>

          {/* Drag & drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              group relative flex aspect-[16/10] cursor-pointer flex-col items-center justify-center rounded-4xl border-4 border-dashed p-8 transition-all duration-500
              md:aspect-video
              ${
                isDragOver
                  ? 'scale-[1.02] border-primary bg-primary/10 shadow-2xl'
                  : 'border-border bg-card shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-xl'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInput}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isProcessing}
              aria-label={t('zone.ariaLabel')}
            />

            {isProcessing ? (
              <div className="animate-in fade-in text-center">
                <Loader2
                  className="mx-auto mb-6 h-16 w-16 animate-spin text-primary"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white md:text-3xl">
                  {t('zone.processing')}
                </h3>
                <p className="font-medium text-zinc-500">{t('zone.processingHint')}</p>
              </div>
            ) : (
              <div className="text-center">
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
                  <Upload size={36} className="md:size-48" aria-hidden="true" />
                </div>

                {/* Upload prompt */}
                <h3 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white md:text-4xl">
                  {t('zone.dropHere')}
                </h3>
                <p className="mx-auto mb-8 max-w-sm text-sm font-medium text-zinc-500 md:text-lg">
                  {t('zone.orBrowse')}
                </p>

                {/* JSON Format badge */}
                <div className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-700 shadow-sm dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertCircle size={14} aria-hidden="true" /> {t('zone.jsonOnly')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - 2 columns */}
        <div className="space-y-6 lg:col-span-2">
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
                onClick={onOpenWizard}
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
        <div className="fixed bottom-4 left-4 z-50">
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

/**
 * Dev-only floating panel to switch between error states.
 * Allows testing all error screens with real Try Again / Show Wizard actions.
 */
function DevErrorSelector({
  currentCode,
  onSelect,
  onClose,
}: {
  currentCode: DiagnosticErrorCode | null;
  onSelect: (code: DiagnosticErrorCode | null) => void;
  onClose: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            🔧 Dev: Error Preview
          </span>
          <span className="text-xs text-zinc-500">
            {currentCode ?? 'none'} • {ALL_DIAGNOSTIC_ERROR_CODES.length} types
          </span>
        </button>

        {/* Error list */}
        {isExpanded && (
          <div className="border-t border-zinc-800 p-3">
            <div className="mb-3 grid max-h-[40vh] grid-cols-2 gap-1 overflow-y-auto">
              {ALL_DIAGNOSTIC_ERROR_CODES.map(code => (
                <button
                  key={code}
                  onClick={() => onSelect(code)}
                  className={`rounded px-2 py-1.5 text-left text-xs transition-colors ${
                    currentCode === code
                      ? 'bg-blue-600 font-medium text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {code.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800 pt-3">
              <button
                onClick={onClose}
                className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Clear Preview
              </button>
            </div>

            {/* Hint */}
            <p className="mt-2 text-[10px] text-zinc-500">
              Click error type to preview. Use &quot;Try Again&quot; and &quot;Show Wizard&quot;
              buttons to test actions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
