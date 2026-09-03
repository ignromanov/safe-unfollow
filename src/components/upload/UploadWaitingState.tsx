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
        {/* h2, not h3: the only heading above this on /upload is the page's
            own h1 (UploadZone), and the guide block's h2 comes after it in
            DOM order - so an h3 here skipped a level in the middle of the
            document. It is a sibling section, not a child of anything. */}
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">{t('waiting.title')}</h2>
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
        {/* Both are controls and neither was drawn as one: "Upload Now" opens
            the file picker and was 14px of underlined text, "Skip for now"
            12px of grey. Same 48px box for both, and the tiers the guide's
            closing card already uses - the filled slot in this block belongs
            to the reminder above, so this is bordered, then ghost.

            Stacked rather than a row, and the reason is measured rather
            than assumed: `fr` carries the longest pair of the ten at 21 and
            21 characters ("Téléverser maintenant" / "Passer pour l'instant"),
            with `id` at 21 for the second. Two side-by-side boxes wrap inside
            themselves at that length, which costs more height than the column
            does and does it in only some locales. */}
        <div className="mt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onUploadNow}
            className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-2xl border border-border bg-card px-6 py-3 text-sm font-black text-primary transition-colors hover:bg-primary/10"
          >
            {t('waiting.uploadNow')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('waiting.skip')}
          </button>
        </div>
      </div>
    </section>
  );
}
