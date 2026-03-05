import { trackEvent } from '@/lib/analytics/core';
import { CheckCircle2, AlertTriangle, HelpCircle, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

type QuizAnswer = 'json' | 'html' | 'not-sure';

const STORAGE_KEY = 'format-quiz-answer';

function getStoredAnswer(): QuizAnswer | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'json' || value === 'html' || value === 'not-sure') return value;
  } catch {
    // localStorage unavailable
  }
  return null;
}

function storeAnswer(answer: QuizAnswer): void {
  try {
    localStorage.setItem(STORAGE_KEY, answer);
  } catch {
    // localStorage unavailable
  }
}

interface FormatQuizProps {
  onOpenWizard?: () => void;
}

export function FormatQuiz({ onOpenWizard }: FormatQuizProps) {
  const { t } = useTranslation('upload');
  // Track whether answer was pre-stored (before this render session)
  const [preStoredAnswer] = useState<QuizAnswer | null>(getStoredAnswer);
  const [answer, setAnswer] = useState<QuizAnswer | null>(preStoredAnswer);
  const [dismissed, setDismissed] = useState(false);

  const handleAnswer = useCallback((selected: QuizAnswer) => {
    setAnswer(selected);
    storeAnswer(selected);
    trackEvent('format_quiz_answer', { answer: selected });
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Already answered JSON before this session, or dismissed — hide completely
  if (dismissed || preStoredAnswer === 'json') {
    return null;
  }

  // No answer yet — show quiz options
  if (!answer) {
    return (
      <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-zinc-900 dark:text-white">{t('quiz.title')}</h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t('quiz.subtitle')}</p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAnswer('json')}
            className="flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:border-emerald-600"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{t('quiz.json')}</span>
            <span className="text-xs font-normal opacity-70">{t('quiz.jsonHint')}</span>
          </button>

          <button
            onClick={() => handleAnswer('html')}
            className="flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:border-amber-600"
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t('quiz.html')}</span>
            <span className="text-xs font-normal opacity-70">{t('quiz.htmlHint')}</span>
          </button>

          <button
            onClick={() => handleAnswer('not-sure')}
            className="flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:border-zinc-500"
          >
            <HelpCircle size={16} aria-hidden="true" />
            <span>{t('quiz.notSure')}</span>
            <span className="text-xs font-normal opacity-70">{t('quiz.notSureHint')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Answered JSON — show success briefly then auto-hide
  if (answer === 'json') {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t('quiz.successMessage')}
        </p>
        <button
          onClick={handleDismiss}
          className="ms-auto shrink-0 text-emerald-500 hover:text-emerald-700"
          aria-label={t('quiz.dismiss')}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // Answered HTML — show warning + redirect to wizard
  if (answer === 'html') {
    return (
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t('quiz.htmlMessage')}
            </p>
            {onOpenWizard && (
              <button
                onClick={onOpenWizard}
                className="mt-2 text-sm font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400"
              >
                {t('quiz.htmlCta')}
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="ms-auto shrink-0 text-amber-500 hover:text-amber-700"
            aria-label={t('quiz.dismiss')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Answered "Not sure" — show comparison
  return (
    <div className="mb-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
      <div className="flex items-start justify-between">
        <h4 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">
          {t('quiz.comparisonTitle')}
        </h4>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-zinc-400 hover:text-zinc-600"
          aria-label={t('quiz.dismiss')}
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        <p className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
          {t('quiz.comparisonJson')}
        </p>
        <p className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
          {t('quiz.comparisonHtml')}
        </p>
      </div>
      {onOpenWizard && (
        <button
          onClick={onOpenWizard}
          className="mt-3 text-xs font-bold text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {t('quiz.htmlCta')}
        </button>
      )}
    </div>
  );
}
