import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GuideRail } from '@/components/guide/GuideRail';
import { GuideStepSection } from '@/components/guide/GuideStepSection';
import { ACCOUNTS_CENTER_URL, GUIDE_STEPS, guideStepAnchorId } from '@/config/wizard-steps';
import type { GuideSource } from '@/hooks/useGuideDialog';
import { analytics } from '@/lib/analytics';
import { openCalendarReminder } from '@/lib/calendar-reminder';

export interface GuideDialogProps {
  open: boolean;
  /** The section the URL claims, or null for "open, with no claim to a section". */
  step: number | null;
  source: GuideSource;
  onGoToStep: (step: number) => void;
  onClose: () => void;
}

/**
 * Which sections are close enough to the viewport to be worth a <video>.
 *
 * Starts empty on purpose: nothing is known to be visible until the observer
 * says so, and the fallback for "we cannot tell" is the cheap render, not the
 * expensive one. Where IntersectionObserver is missing the dialog is all
 * lazy images, which is a degradation nobody can see and everybody can afford.
 */
function useSectionsInView(scrollRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [inView, setInView] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    const root = scrollRef.current;
    if (!enabled || !root || typeof IntersectionObserver === 'undefined') return;

    // The node-to-step map is built once, from the same helper that wrote the
    // ids, so the callback never parses a step number back out of a DOM
    // attribute — the observer already knows which section it is looking at.
    const stepOf = new Map<Element, number>();
    for (const step of GUIDE_STEPS) {
      const node = root.querySelector(`#${guideStepAnchorId(step.id)}`);
      if (node) stepOf.set(node, step.id);
    }

    const observer = new IntersectionObserver(
      entries => {
        setInView(previous => {
          let next: Set<number> | null = null;
          for (const entry of entries) {
            const id = stepOf.get(entry.target);
            // Additive: a section that has been seen keeps its video rather
            // than tearing it down and paying for it again on the way back.
            if (id === undefined || !entry.isIntersecting || previous.has(id)) continue;
            next ??= new Set(previous);
            next.add(id);
          }
          // Same set when nothing was added: the observer fires on every
          // scroll past a boundary, and a fresh Set each time would re-render
          // seven sections to say nothing changed.
          return next ?? previous;
        });
      },
      { root, rootMargin: '200px 0px' }
    );

    for (const node of stepOf.keys()) observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef, enabled]);

  return inView;
}

/**
 * Eight screens become one scroll.
 *
 * Built on the existing Radix primitive rather than a second modal
 * implementation — the primitive brings the scroll lock, the close button and
 * the focus trap, and taking it retires `focus-trap-react`'s last consumer.
 * What it does not bring is a scroll container: DialogContent is a centred
 * `fixed` with no max-height and no overflow, so the container is declared
 * here, and it is this container that scrolls to a section anchor.
 *
 * Exactly one DialogTitle (GH#140). No second close button: the primitive
 * renders its own, labelled from `common:buttons.close`.
 */
export function GuideDialog({ open, step, source, onGoToStep, onClose }: GuideDialogProps) {
  const { t } = useTranslation('wizard');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useSectionsInView(scrollRef, open);
  // Whether this opening has already scrolled once. Reset on close, so the
  // next opening arrives with the same 'auto' jump rather than inheriting
  // the 'smooth' behaviour a rail tap earns later in the same session.
  const hasArrivedRef = useRef(false);
  // Forces the arrival effect below to re-run even when `step` is unchanged —
  // needed because a rail tap on the section the reader is already at (by
  // the URL's account) would otherwise be a no-op scroll.
  const [scrollNonce, setScrollNonce] = useState(0);

  const scrollToStep = useCallback((target: number, behavior: ScrollBehavior) => {
    const root = scrollRef.current;
    const section = root?.querySelector<HTMLElement>(`#${guideStepAnchorId(target)}`);
    if (!root || !section) return;

    // scroll-margin-top (the `scroll-mt-4` this replaced) is honoured by
    // scrollIntoView and scroll-snap, not by a manual scrollTo — so the 16px
    // gap is subtracted here instead, where it actually takes effect.
    root.scrollTo?.({ top: section.offsetTop - root.offsetTop - 16, behavior });

    // A deep link or a rail tap moves the viewport, but Radix leaves focus
    // wherever it put it on open (the first rail button) — a keyboard or
    // screen-reader user needs focus to agree with what they're now seeing.
    section.querySelector<HTMLElement>('h3')?.focus();
  }, []);

  // Scroll to the claimed section. Runs on every `step` change (a rail tap
  // and a URL arriving with ?step=6 take the same path) and on scrollNonce
  // (a rail tap that doesn't change `step` at all).
  useEffect(() => {
    if (!open) {
      hasArrivedRef.current = false;
      return;
    }
    if (step === null) return;

    // The first scroll of an opening jumps straight there; animating past
    // several sections' worth of pixels on arrival is a self-inflicted
    // layout shift. A later rail tap, within the same opening, animates.
    scrollToStep(step, hasArrivedRef.current ? 'smooth' : 'auto');
    hasArrivedRef.current = true;
  }, [open, step, scrollNonce, scrollToStep]);

  const handleRailSelect = useCallback(
    (target: number) => {
      onGoToStep(target);
      setScrollNonce(n => n + 1);
    },
    [onGoToStep]
  );

  const handleReminder = useCallback(() => {
    openCalendarReminder(t('calendar.title'), t('calendar.details'));
  }, [t]);

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent
        // flex flex-col: the base class in ui/dialog.tsx is `grid`, and `cn()`
        // (tailwind-merge) lets this later class win. The scroll container
        // below then sizes itself off the header's *real* height via flex-1,
        // instead of a hand-maintained `calc(90vh - Nrem)` that drifts every
        // time the header's content changes (a wrapped title, the "Step N of
        // 7" label appearing). rounded-3xl/shadow-2xl match the house style
        // for modals (AlertDialogContent) — every card inside this one is
        // already rounded-3xl, and the shell was the one holdout at rounded-lg.
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-border px-4 pb-3 pt-4 pe-12">
          <DialogTitle className="text-base">
            {t('entry.accordion.trigger', { count: GUIDE_STEPS.length })}
          </DialogTitle>
          <GuideRail current={step} onSelect={handleRailSelect} />
        </DialogHeader>

        <div
          ref={scrollRef}
          data-guide-scroll
          // tabIndex/role/aria-label: Chrome makes an overflow container
          // focusable by default, Firefox and Safari do not — and the seven
          // sections inside contain no interactive elements of their own, so
          // without this a keyboard user tabs straight past all of them to
          // the footer buttons.
          tabIndex={0}
          role="group"
          aria-label={t('entry.accordion.trigger', { count: GUIDE_STEPS.length })}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* Only for a reader who arrived by URL — from an error screen or a
              shared link. Someone who opened this from the page scrolled past
              the same CTA moments ago, and repeating it at full width is the
              second entry screen this whole move exists to remove. */}
          {source === 'url' && (
            <a
              href={ACCOUNTS_CENTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.linkClick('meta_accounts')}
              className="inline-flex min-h-[48px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-normal rounded-2xl bg-primary px-6 py-3 text-center text-sm font-black text-primary-foreground shadow-lg"
            >
              {t('entry.cta')} <ExternalLink size={18} className="shrink-0" aria-hidden="true" />
            </a>
          )}

          {GUIDE_STEPS.map(guideStep => (
            <GuideStepSection
              key={guideStep.id}
              step={guideStep}
              isInView={inView.has(guideStep.id)}
            />
          ))}

          {/* The guide cannot end in "upload it now": Instagram sends the file
              in 5-30 minutes and the reader has nothing to upload yet. The
              reminder is the only action available at this point, so it takes
              the primary weight and closing takes the secondary. */}
          <div className="flex shrink-0 flex-col gap-3 rounded-3xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={handleReminder}
              className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-lg"
            >
              <Calendar size={18} aria-hidden="true" />
              {t('calendar.addReminder')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              {t('buttons.close')}
            </button>
            {/* The one line the design never had: three screens of scroll on a
                product whose single load-bearing promise is this sentence. */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('entry.trust.local')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
