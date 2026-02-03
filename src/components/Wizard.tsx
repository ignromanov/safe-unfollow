'use client';

import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, ExternalLink, AlertTriangle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { analytics } from '@/lib/analytics';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { ResponsiveGif } from '@/components/ResponsiveGif';

interface WizardStep {
  id: number;
  externalLink?: string;
  isWarning?: boolean;
  visual?: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    externalLink:
      'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings',
    visual: '/wizard/step-1',
  },
  {
    id: 2,
    visual: '/wizard/step-2',
  },
  {
    id: 3,
    visual: '/wizard/step-3',
  },
  {
    id: 4,
    isWarning: true,
    visual: '/wizard/step-4',
  },
  {
    id: 5,
    visual: '/wizard/step-5',
  },
  {
    id: 6,
    isWarning: true,
    visual: '/wizard/step-6',
  },
  {
    id: 7,
    visual: '/wizard/step-7',
  },
  {
    id: 8,
    visual: '/wizard/step-8',
  },
];

interface WizardProps {
  initialStep?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function Wizard({ initialStep = 1, onComplete, onCancel }: WizardProps) {
  const { t } = useTranslation('wizard');
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  // Derive step from URL (single source of truth)
  const stepFromUrl = (() => {
    const match = location.pathname.match(/\/wizard\/step\/(\d+)/);
    if (match?.[1]) {
      const step = parseInt(match[1], 10);
      if (step >= 1 && step <= WIZARD_STEPS.length) {
        return step;
      }
    }
    return initialStep;
  })();

  const currentStep = stepFromUrl;

  // Track analytics on step view
  useEffect(() => {
    const stepTitle = t(`steps.${currentStep}.title` as any);
    analytics.wizardStepView(currentStep, String(stepTitle));
  }, [currentStep, t]);

  // Navigate to step via URL
  const goToStep = useCallback(
    (step: number) => {
      navigate(`${prefix}/wizard/step/${step}`, { replace: true });
    },
    [navigate, prefix]
  );

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
      analytics.wizardBackClick(currentStep);
      goToStep(Math.max(currentStep - 1, 1));
    }
  };

  const handleCancel = () => {
    analytics.wizardCancel();
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
    <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
      {/* Header - Compact */}
      <div className="container mx-auto px-4 py-2 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <span className="font-bold text-xs md:text-sm text-zinc-500 uppercase tracking-widest">
            {t('header.stepOf', { current: currentStep, total: WIZARD_STEPS.length })}
          </span>
          <div className="flex gap-1.5">
            {WIZARD_STEPS.map(s => (
              <div
                key={s.id}
                className={`h-1.5 w-6 md:w-8 rounded-full transition-all duration-300 ${
                  s.id <= currentStep ? 'bg-primary' : 'bg-border'
                }`}
              />
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

      {/* Content */}
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
                  loading="lazy"
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
                <div className="absolute top-4 left-4 p-2.5 bg-amber-400 text-black rounded-xl shadow-lg flex items-center gap-2 font-black text-xs animate-bounce">
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

              {/* Navigation buttons - inside card */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                <button
                  onClick={handleBack}
                  disabled={isFirstStep}
                  className={`cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                    isFirstStep
                      ? 'opacity-0 pointer-events-none'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <ArrowLeft size={18} />
                  <span className="hidden sm:inline">{t('buttons.back')}</span>
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
        </div>
      </div>
    </div>
  );
}
