import { useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, X, ExternalLink, AlertTriangle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';

import { analytics } from '@/lib/analytics';
import { ResponsiveGif } from '@/components/ResponsiveGif';
import { WIZARD_STEPS } from '@/config/wizard-steps';
import { useWizardNavigation } from '@/hooks/useWizardNavigation';

interface WizardProps {
  initialStep?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function Wizard({ initialStep = 1, onComplete, onCancel }: WizardProps) {
  const { t } = useTranslation('wizard');
  const { currentStep, goToStep, prefix, navigate } = useWizardNavigation(initialStep);

  // Track analytics on step view
  useEffect(() => {
    const stepTitle = t(`steps.${currentStep}.title` as any);
    analytics.wizardStepView(currentStep, String(stepTitle));
  }, [currentStep, t]);

  const step = WIZARD_STEPS.find(s => s.id === currentStep);
  if (!step) {
    return null;
  }

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === WIZARD_STEPS.length;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      goToStep(Math.min(currentStep + 1, WIZARD_STEPS.length));
    }
  };

  const handleBack = () => {
    if (isFirstStep) {
      onCancel();
    } else {
      goToStep(Math.max(currentStep - 1, 1));
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleCalendarReminder = useCallback(() => {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 1);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + 30);

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      t('calendar.title')
    )}&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${
      endDate.toISOString().replace(/[-:]/g, '').split('.')[0]
    }Z&details=${encodeURIComponent(t('calendar.details'))}`;

    window.open(calendarUrl, '_blank', 'noopener,noreferrer');
  }, [t]);

  return (
    <WizardFocusTrap onEscape={handleBack}>
      <div
        className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('header.ariaLabel', { defaultValue: 'Instagram data export wizard' })}
      >
        {/* Header - Compact */}
        <div className="shrink-0 container mx-auto px-4 py-2 flex items-center justify-between border-b border-border bg-card">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="hidden md:block font-bold text-sm text-zinc-500 uppercase tracking-widest whitespace-nowrap">
              {t('header.stepOf', { current: currentStep, total: WIZARD_STEPS.length })}
            </span>
            {/* Step indicator dots — flex-1 to fill available space */}
            <div
              className="flex flex-1"
              role="tablist"
              aria-label={t('header.stepNavigation', { defaultValue: 'Step navigation' })}
            >
              {WIZARD_STEPS.map(s => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === currentStep}
                  aria-label={t('header.stepLabel', { step: s.id, defaultValue: `Step ${s.id}` })}
                  onClick={() => goToStep(s.id)}
                  className="flex-1 min-h-[44px] flex items-center justify-center"
                >
                  <span
                    className={`block h-1.5 w-full max-w-8 rounded-full transition-all duration-300 ${
                      s.id <= currentStep ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCancel}
            aria-label={t('buttons.close')}
            className="cursor-pointer p-2.5 rounded-full hover:bg-[oklch(0.5_0_0_/_0.05)] transition-colors"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div
              className={`max-w-xl w-full rounded-4xl overflow-hidden shadow-2xl border transition-all ${
                step.isWarning
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50'
                  : 'border-border bg-card'
              }`}
            >
              {/* Image - width-first, height auto, aligned to bottom */}
              <div className="bg-[oklch(0.5_0_0_/_0.05)] overflow-hidden relative flex items-end">
                {step.visual ? (
                  <ResponsiveGif
                    basePath={step.visual}
                    alt={t(`steps.${currentStep}.alt` as any)}
                    className="w-full h-auto block"
                  />
                ) : (
                  <img
                    src={`https://picsum.photos/seed/${step.id}/800/600`}
                    alt={t(`steps.${currentStep}.alt` as any)}
                    width={800}
                    height={600}
                    className="w-full h-auto block"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                {step.isWarning && (
                  <div className="absolute top-4 start-4 p-2.5 bg-amber-400 text-black rounded-xl shadow-lg flex items-center gap-2 font-black text-xs animate-bounce">
                    <AlertTriangle size={18} />
                    {t('format.warning')}
                  </div>
                )}
              </div>

              {/* Step Info */}
              <div className="p-6 md:p-8">
                <h2
                  className={`text-2xl md:text-3xl font-display font-bold mb-5 leading-tight ${
                    step.isWarning
                      ? 'text-amber-800 dark:text-amber-500'
                      : 'text-zinc-900 dark:text-white'
                  }`}
                >
                  {t(`steps.${currentStep}.title` as any)}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-xl leading-relaxed mb-10 font-medium">
                  {t(`steps.${currentStep}.description` as any)}
                </p>

                {/* External Link Button (step 1) */}
                {step.externalLink && (
                  <div className="flex flex-col items-center sm:items-start gap-4">
                    <a
                      href={step.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base w-full sm:w-auto"
                    >
                      {t('buttons.openInstagram')} <ExternalLink size={20} />
                    </a>

                    {/* Already have file shortcut */}
                    <button
                      onClick={() => navigate(`${prefix}/upload`)}
                      className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary dark:hover:text-primary transition-colors group"
                    >
                      {t('buttons.alreadyHaveFile')}
                      <ArrowRight
                        size={14}
                        className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                      />
                    </button>
                  </div>
                )}

                {/* Last step: Calendar reminder button */}
                {isLastStep && (
                  <button
                    onClick={handleCalendarReminder}
                    className="cursor-pointer inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base w-full sm:w-auto"
                  >
                    <Calendar size={20} />
                    {t('calendar.addReminder')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned navigation bar — outside scrollable content */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button
              onClick={handleBack}
              className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-muted text-muted-foreground"
            >
              <ArrowLeft size={18} />
              <span>
                {isFirstStep ? t('buttons.cancel', { defaultValue: 'Cancel' }) : t('buttons.back')}
              </span>
            </button>
            <button
              onClick={handleNext}
              className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {isLastStep ? t('buttons.done') : t('buttons.next')}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </WizardFocusTrap>
  );
}

/** Focus trap wrapper for the wizard dialog */
function WizardFocusTrap({
  children,
  onEscape,
}: {
  children: React.ReactNode;
  onEscape: () => void;
}) {
  // Handle ESC key to navigate back / close wizard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: true,
        escapeDeactivates: false,
        initialFocus: false,
        fallbackFocus: '[role="dialog"]',
      }}
    >
      {children}
    </FocusTrap>
  );
}
