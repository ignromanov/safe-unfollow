import { Calendar } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { openCalendarReminder } from '@/lib/calendar-reminder';

interface UploadWaitingStateProps {
  /** Focus the file picker for someone who turns out to have the file already. */
  onUploadNow: () => void;
  onDismiss: () => void;
}

/**
 * What to do during the 5-30 minutes Instagram takes.
 *
 * Every string here has been translated into ten locales since the wizard
 * shipped and rendered nowhere: `upload.waiting.*` had no consumer in `src/`
 * at all. Among them is the one operationally true thing the design never
 * said — the email lands in spam and the download link expires in four days.
 *
 * It never replaces the drop zone. Someone who clicks through, checks their
 * email and finds the file must not have to undo a state to upload it, which
 * is what `waiting.haveFile` was always for.
 */
export function UploadWaitingState({ onUploadNow, onDismiss }: UploadWaitingStateProps) {
  const { t } = useTranslation('upload');

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-primary/30 bg-primary/5 p-5">
      <div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">{t('waiting.title')}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t('waiting.description')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() =>
            openCalendarReminder(t('waiting.calendarTitle'), t('waiting.calendarDetails'))
          }
          className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-lg"
        >
          <Calendar size={18} aria-hidden="true" />
          {t('waiting.addReminder')}
        </button>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          {t('waiting.reminderHint')}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-xs font-bold text-amber-800 dark:text-amber-500">
          {t('waiting.proTip')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/70">
          <Trans i18nKey="waiting.proTipHint" ns="upload" components={{ b: <b /> }} />
        </p>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <p className="text-sm font-bold text-zinc-900 dark:text-white">{t('waiting.haveFile')}</p>
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t('waiting.haveFileHint')}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onUploadNow}
            className="cursor-pointer text-sm font-black text-primary hover:underline"
          >
            {t('waiting.uploadNow')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {t('waiting.skip')}
          </button>
        </div>
      </div>
    </section>
  );
}
