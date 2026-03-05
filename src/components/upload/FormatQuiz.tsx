import { trackEvent } from '@/lib/stats/core';
import { CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type QuizAnswer = 'json' | 'html' | 'not-sure';

const ANSWER_KEY = 'format-quiz-answer';
const DISMISS_KEY = 'format-quiz-dismissed';

function getStoredAnswer(): QuizAnswer | null {
  try {
    const value = localStorage.getItem(ANSWER_KEY);
    if (value === 'json' || value === 'html' || value === 'not-sure') return value;
  } catch {
    // localStorage unavailable
  }
  return null;
}

function storeAnswer(answer: QuizAnswer): void {
  try {
    localStorage.setItem(ANSWER_KEY, answer);
  } catch {
    // localStorage unavailable
  }
}

function isDismissedStored(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function storeDismiss(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(DISMISS_KEY, '1');
    } else {
      localStorage.removeItem(DISMISS_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

function clearQuizStorage(): void {
  try {
    localStorage.removeItem(ANSWER_KEY);
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // localStorage unavailable
  }
}

export interface FormatQuizProps {
  onOpenWizard?: () => void;
  isProcessing?: boolean;
}

export function FormatQuiz({ onOpenWizard, isProcessing = false }: FormatQuizProps) {
  const { t } = useTranslation('upload');
  // SSR-safe: start with null/false, hydrate from localStorage in useEffect
  const [mounted, setMounted] = useState(false);
  const [preStoredAnswer, setPreStoredAnswer] = useState<QuizAnswer | null>(null);
  const [answer, setAnswer] = useState<QuizAnswer | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Read localStorage only on client after hydration
  useEffect(() => {
    const stored = getStoredAnswer();
    const wasDismissed = isDismissedStored();
    setPreStoredAnswer(stored);
    setAnswer(stored);
    setDismissed(wasDismissed);
    setMounted(true);
  }, []);

  const handleAnswer = useCallback((selected: QuizAnswer) => {
    setAnswer(selected);
    storeAnswer(selected);
    trackEvent('format_quiz_answer', { answer: selected });
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    storeDismiss(true);
  }, []);

  const handleFixedIt = useCallback(() => {
    clearQuizStorage();
    setAnswer(null);
    setDismissed(false);
    trackEvent('format_quiz_fixed_it');
  }, []);

  // Hide during upload processing
  if (isProcessing) return null;

  // Don't render until client-side localStorage is read (prevents SSR hydration mismatch)
  if (!mounted) return null;

  // Already answered JSON before this session, or dismissed — hide completely
  if (dismissed || preStoredAnswer === 'json') return null;

  // No answer yet — show quiz options
  if (!answer) {
    return (
      <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h3
          id="format-quiz-title"
          className="mb-1 text-base font-bold text-zinc-900 dark:text-white md:text-sm"
        >
          {t('quiz.title')}
        </h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400 sm:mb-6 md:text-xs">
          {t('quiz.subtitle')}
        </p>

        <div
          role="radiogroup"
          aria-labelledby="format-quiz-title"
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
        >
          <button
            role="radio"
            aria-checked="false"
            onClick={() => handleAnswer('json')}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-start text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:border-emerald-600 sm:w-auto"
          >
            <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
            <span>{t('quiz.json')}</span>
            <span className="text-sm opacity-70 sm:text-xs">{t('quiz.jsonHint')}</span>
          </button>

          <button
            role="radio"
            aria-checked="false"
            onClick={() => handleAnswer('html')}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-start text-sm font-semibold text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:border-amber-600 sm:w-auto"
          >
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            <span>{t('quiz.html')}</span>
            <span className="text-sm opacity-70 sm:text-xs">{t('quiz.htmlHint')}</span>
          </button>

          <button
            role="radio"
            aria-checked="false"
            onClick={() => handleAnswer('not-sure')}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-start text-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:border-zinc-500 sm:w-auto"
          >
            <HelpCircle size={16} className="shrink-0" aria-hidden="true" />
            <span>{t('quiz.notSure')}</span>
            <span className="text-sm opacity-70 sm:text-xs">{t('quiz.notSureHint')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Answered JSON — show success briefly
  if (answer === 'json') {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t('quiz.successMessage')}
        </p>
        <button
          onClick={handleDismiss}
          className="ms-auto min-h-[44px] min-w-[44px] shrink-0 p-2 text-emerald-500 hover:text-emerald-700"
          aria-label={t('quiz.dismiss')}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // Answered HTML — show warning + redirect to wizard + "I've fixed it"
  if (answer === 'html') {
    return (
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t('quiz.htmlMessage')}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {onOpenWizard && (
                <button
                  onClick={onOpenWizard}
                  className="min-h-[44px] text-sm font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400"
                >
                  {t('quiz.htmlCta')}
                </button>
              )}
              <button
                onClick={handleFixedIt}
                className="flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-amber-600 underline underline-offset-2 hover:text-amber-800 dark:text-amber-500"
              >
                <RefreshCw size={14} aria-hidden="true" />
                {t('quiz.fixedIt')}
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="min-h-[44px] min-w-[44px] shrink-0 p-2 text-amber-500 hover:text-amber-700"
            aria-label={t('quiz.dismiss')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Answered "Not sure" — show comparison + "I've fixed it"
  return (
    <div className="mb-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
      <div className="flex items-start justify-between">
        <h4 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">
          {t('quiz.comparisonTitle')}
        </h4>
        <button
          onClick={handleDismiss}
          className="min-h-[44px] min-w-[44px] shrink-0 p-2 text-zinc-400 hover:text-zinc-600"
          aria-label={t('quiz.dismiss')}
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        <p className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400 md:text-xs">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
          {t('quiz.comparisonJson')}
        </p>
        <p className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400 md:text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
          {t('quiz.comparisonHtml')}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {onOpenWizard && (
          <button
            onClick={onOpenWizard}
            className="min-h-[44px] text-sm font-bold text-primary underline underline-offset-2 hover:text-primary/80 md:text-xs"
          >
            {t('quiz.htmlCta')}
          </button>
        )}
        <button
          onClick={handleFixedIt}
          className="flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 md:text-xs"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t('quiz.fixedIt')}
        </button>
      </div>
    </div>
  );
}
