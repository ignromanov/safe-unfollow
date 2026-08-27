import { useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X, AlertTriangle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';

import { analytics } from '@/lib/analytics';
import { openCalendarReminder } from '@/lib/calendar-reminder';
import { PrefixedLink } from '@/components/PrefixedLink';
import { ResponsiveGif } from '@/components/ResponsiveGif';
import { UploadGuideBlock } from '@/components/upload/UploadGuideBlock';
import { GUIDE_STEPS } from '@/config/wizard-steps';
import { useWizardNavigation } from '@/hooks/useWizardNavigation';

/**
 * The eight live `/wizard/step/N` URLs, which outnumber the seven guide
 * sections by exactly the entry screen that became a document block.
 */
const WIZARD_ROUTE_COUNT = GUIDE_STEPS.length + 1;
const WIZARD_ROUTE_IDS = Array.from({ length: WIZARD_ROUTE_COUNT }, (_, i) => i + 1);

interface WizardProps {
  initialStep?: number;
}

export function Wizard({ initialStep = 1 }: WizardProps) {
  const { t } = useTranslation('wizard');
  const { currentStep, goToStep, goHome } = useWizardNavigation(initialStep);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // The wizard scrolls in the container below, and WizardPage never remounts
  // across wizard URLs (routes.tsx reuses one element for every :stepId), so
  // its scrollTop survives every step change — useLayoutState resets the
  // window, which is a no-op behind this `fixed inset-0` overlay. Step 1 is
  // now much taller than a step card and its accordion rows are step links,
  // so without this a reader navigates from deep in one step and arrives
  // partway down the next.
  //
  // The first run is skipped on purpose: on mount a non-zero scrollTop is the
  // position a reader reached before hydration, and yanking them to the top
  // there is the same class of defect the swap gate above prevents.
  const hasRenderedStep = useRef(false);
  useEffect(() => {
    if (!hasRenderedStep.current) {
      hasRenderedStep.current = true;
      return;
    }
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [currentStep]);

  // Track analytics on step view. Step 1 stays exempt, and the reason changed
  // with this PR rather than disappearing: it used to emit guide_entry_view
  // from GuideEntry, which is gone. Adding step 1 to wizard_step_view now
  // would open a value in that series days before PR 3 deletes these routes
  // altogether — noise, not a measurement. The guide's own view event is
  // redesigned as guide_open in PR 4, on the surface it actually lives on.
  useEffect(() => {
    if (currentStep === 1) return;
    analytics.wizardStepView(currentStep);
  }, [currentStep]);

  // The route numbering and the guide numbering are no longer the same thing,
  // and this is where they meet. GUIDE_STEPS renumbered its seven sections
  // 1..7 for the popup; these eight URLs are indexed and keep the numbering
  // they shipped with until PR 3 removes them. Route 1 is the guide block
  // (it was the entry screen); route N>1 is section N-1. Renaming eight
  // indexed pages twice — once here, once at removal — buys nothing.
  const step = GUIDE_STEPS.find(s => s.id === currentStep - 1);
  const isFirstStep = currentStep === 1;
  if (!step && !isFirstStep) {
    return null;
  }

  const isLastStep = currentStep === WIZARD_ROUTE_COUNT;

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
    openCalendarReminder(t('calendar.title'), t('calendar.details'));
  }, [t]);

  return (
    <WizardFocusTrap onEscape={handleBack}>
      <div
        className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('header.ariaLabel')}
      >
        {/* Header - Compact */}
        <div className="shrink-0 container mx-auto px-4 py-2 flex items-center justify-between border-b border-border bg-card">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* `sr-only`, not `hidden`, below md: the step dots' own labels say
                "Step 3" and carry no total — the implicit aria-posinset /
                aria-setsize went away with role="tablist". This span is the
                only element that holds one, and `display:none` would keep it
                out of the accessibility tree for the 85% of readers who are on
                mobile. Nothing changes visually at any width. */}
            <span className="sr-only md:not-sr-only md:block font-bold text-sm text-zinc-500 uppercase tracking-widest whitespace-nowrap">
              {t('header.stepOf', { current: currentStep, total: WIZARD_ROUTE_COUNT })}
            </span>
            {/* Step indicator dots — flex-1 to fill available space */}
            <nav className="flex flex-1" aria-label={t('header.stepNavigation')}>
              {WIZARD_ROUTE_IDS.map(routeId => (
                <PrefixedLink
                  key={routeId}
                  to={`/wizard/step/${routeId}`}
                  aria-current={routeId === currentStep ? 'step' : undefined}
                  aria-label={t('header.stepLabel', { step: routeId })}
                  className="flex-1 min-h-[44px] flex items-center justify-center"
                >
                  <span
                    className={`block h-1.5 w-full max-w-8 rounded-full transition-all duration-300 ${
                      routeId <= currentStep ? 'bg-primary' : 'bg-border'
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
              <div className="w-full max-w-xl">
                <UploadGuideBlock />
              </div>
            ) : step ? (
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
                      alt={t(`steps.${step.id}.alt` as any)}
                      className="w-full h-auto block"
                    />
                  ) : (
                    <img
                      src={`https://picsum.photos/seed/${step.id}/800/600`}
                      alt={t(`steps.${step.id}.alt` as any)}
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
                    {t(`steps.${step.id}.title` as any)}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-xl leading-relaxed mb-10 font-medium">
                    {t(`steps.${step.id}.description` as any)}
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
            ) : null}
          </div>
        </div>

        {/* Pinned navigation bar — outside scrollable content, and now
            unconditional Back/Next on every step.

            It used to swap both slots on step 1 once the in-flow Accounts
            Center CTA scrolled out of view, so that a screen with exactly one
            action always showed that action. Step 1 stopped being such a
            screen: it renders the guide block, a section of the upload
            document (UploadGuideBlock). With the swap go `min-h-16`, which
            reserved height for the swapped pair's two-line labels, and the
            IntersectionObserver that drove it.

            The hydration invariant that swap needed is NOT retired with it —
            a prerendered anchor's destination must not change in the frame
            the page becomes interactive, and that binds any control an
            observer decides. It is recorded against the popup rail in the
            PR-2 plan. */}
        <nav
          className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-label={t('footer.navigation')}
        >
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <PrefixedLink
              to={isFirstStep ? '/' : `/wizard/step/${currentStep - 1}`}
              className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-muted text-muted-foreground"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{isFirstStep ? t('buttons.cancel') : t('buttons.back')}</span>
            </PrefixedLink>
            <PrefixedLink
              to={isLastStep ? '/upload' : `/wizard/step/${currentStep + 1}`}
              className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {isLastStep ? t('buttons.done') : t('buttons.next')}
              <ArrowRight size={18} />
            </PrefixedLink>
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
