import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X, AlertTriangle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';

import { analytics } from '@/lib/analytics';
import { GuideEntry } from '@/components/wizard/GuideEntry';
import { PrefixedLink } from '@/components/PrefixedLink';
import { ResponsiveGif } from '@/components/ResponsiveGif';
import { ACCOUNTS_CENTER_URL, WIZARD_STEPS } from '@/config/wizard-steps';
import { useIsElementInView } from '@/hooks/useIsElementInView';
import { useWizardNavigation } from '@/hooks/useWizardNavigation';

interface WizardProps {
  initialStep?: number;
}

export function Wizard({ initialStep = 1 }: WizardProps) {
  const { t } = useTranslation('wizard');
  const { currentStep, goToStep, goHome } = useWizardNavigation(initialStep);
  // Only meaningful on step 1 — GuideEntry (and its <a ref={ctaRef}>) is
  // unmounted on every other step, so the hook has nothing attached there
  // and its default (true) is inert.
  const [ctaInView, ctaRef] = useIsElementInView<HTMLAnchorElement>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // A prerendered anchor's destination must not change in the same frame the
  // page becomes interactive. IntersectionObserver delivers its first callback
  // on observe(), so a reader who scrolled past the in-flow CTA while JS was
  // still loading would otherwise have the bar's two slots swap the instant
  // hydration completes — including the right slot, from an in-app route to a
  // cross-origin target="_blank" link — under a thumb already on it. This flag
  // is set by a scroll that happens *after* the listener attached, i.e. after
  // hydration, so such a reader keeps the bar the static HTML showed them
  // until they scroll again. The wizard scrolls in the inner container below,
  // never the window, so that is where the listener goes.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const markScrolled = () => setHasScrolled(true);
    container.addEventListener('scroll', markScrolled, { passive: true });
    return () => container.removeEventListener('scroll', markScrolled);
  }, []);

  // Track analytics on step view. Step 1 is GuideEntry, which reports its
  // own guideEntryView — reporting wizardStepView here too would double the
  // view event for the same screen (see GuideEntry.tsx).
  useEffect(() => {
    if (currentStep === 1) return;
    analytics.wizardStepView(currentStep);
  }, [currentStep]);

  const step = WIZARD_STEPS.find(s => s.id === currentStep);
  if (!step) {
    return null;
  }

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === WIZARD_STEPS.length;
  // Step 1 only: once the in-flow CTA scrolls out of view, the bottom bar
  // takes over as the primary action so there is always exactly one on
  // screen. Every other step keeps its normal Back/Next bar. `hasScrolled`
  // gates the swap on a post-hydration scroll — see the effect above.
  const showBarPrimary = isFirstStep && hasScrolled && !ctaInView;

  // Back/Next/Done/the step dots/Close guide are now plain PrefixedLinks — each
  // computes its own destination, so the browser can follow it before hydration.
  // Escape cannot follow an `href`, so it keeps a real navigate() call here.
  const handleBack = () => {
    if (isFirstStep) {
      goHome();
    } else {
      goToStep(Math.max(currentStep - 1, 1));
    }
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
            <nav className="flex flex-1" aria-label={t('header.stepNavigation')}>
              {WIZARD_STEPS.map(s => (
                <PrefixedLink
                  key={s.id}
                  to={`/wizard/step/${s.id}`}
                  aria-current={s.id === currentStep ? 'step' : undefined}
                  aria-label={t('header.stepLabel', { step: s.id })}
                  className="flex-1 min-h-[44px] flex items-center justify-center"
                >
                  <span
                    className={`block h-1.5 w-full max-w-8 rounded-full transition-all duration-300 ${
                      s.id <= currentStep ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                </PrefixedLink>
              ))}
            </nav>
          </div>
          <PrefixedLink
            to="/"
            aria-label={t('buttons.close')}
            className="cursor-pointer p-2.5 rounded-full hover:bg-[oklch(0.5_0_0_/_0.05)] transition-colors"
          >
            <X size={24} aria-hidden="true" />
          </PrefixedLink>
        </div>

        {/* Scrollable content area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            {currentStep === 1 ? (
              <GuideEntry ctaRef={ctaRef} />
            ) : (
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

                  {/* Last step: Calendar reminder button */}
                  {isLastStep && (
                    <button
                      onClick={handleCalendarReminder}
                      className="cursor-pointer inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base w-full sm:w-auto"
                    >
                      <Calendar size={20} />
                      {t('calendar.addReminder')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pinned navigation bar — outside scrollable content. On step 1, once
            the in-flow CTA (GuideEntry's own Accounts Center link) scrolls
            out of view, this bar's two slots swap label and destination to
            take over as the primary action — see showBarPrimary above.

            Only the secondary slot keeps its element identity across that
            swap (one PrefixedLink with a ternary `to`). The primary slot
            renders an <a> in one branch and a PrefixedLink in the other —
            two component types at the same position, so React unmounts one
            and mounts the other, and focus on that control is lost to
            <body> when the swap fires.

            The bar's height is held by `min-h-16` below, not by identity:
            neither label carries `truncate` or `whitespace-nowrap`, the row
            does not wrap, and the swapped pair is far wider than the ~196px
            an inner row gets at 360px — so the labels wrap to two lines.
            16 = the two-line case: 2 × 20px (text-sm leading) + 24px (the
            controls' py-3). */}
        <nav
          className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-label={t('footer.navigation')}
        >
          <div className="max-w-xl mx-auto flex min-h-16 items-center justify-between">
            <PrefixedLink
              to={
                showBarPrimary
                  ? '/sample'
                  : isFirstStep
                    ? '/'
                    : `/wizard/step/${currentStep - 1}`
              }
              className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-muted text-muted-foreground"
            >
              <ArrowLeft size={18} />
              <span>
                {showBarPrimary
                  ? t('buttons.trySample')
                  : isFirstStep
                    ? t('buttons.cancel')
                    : t('buttons.back')}
              </span>
            </PrefixedLink>
            {showBarPrimary ? (
              // Same action as the in-flow CTA (GuideEntry.tsx) — external,
              // opens in a new tab — not an in-app PrefixedLink.
              <a
                href={ACCOUNTS_CENTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {t('entry.cta')}
                <ArrowRight size={18} />
              </a>
            ) : (
              <PrefixedLink
                to={isLastStep ? '/upload' : `/wizard/step/${currentStep + 1}`}
                className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {isLastStep ? t('buttons.done') : t('buttons.next')}
                <ArrowRight size={18} />
              </PrefixedLink>
            )}
          </div>
        </nav>
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
