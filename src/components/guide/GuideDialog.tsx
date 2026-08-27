import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GuideRail } from '@/components/guide/GuideRail';
import { GuideStepSection } from '@/components/guide/GuideStepSection';
import { ACCOUNTS_CENTER_URL, GUIDE_STEPS } from '@/config/wizard-steps';
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

    const observer = new IntersectionObserver(
      entries => {
        setInView(previous => {
          const next = new Set(previous);
          for (const entry of entries) {
            const id = Number(entry.target.getAttribute('id')?.replace('guide-step-', ''));
            if (!Number.isInteger(id)) continue;
            // Additive: a section that has been seen keeps its video rather
            // than tearing it down and paying for it again on the way back.
            if (entry.isIntersecting) next.add(id);
          }
          return next;
        });
      },
      { root, rootMargin: '200px 0px' }
    );

    for (const step of GUIDE_STEPS) {
      const node = root.querySelector(`#guide-step-${step.id}`);
      if (node) observer.observe(node);
    }
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

  // Scroll to the claimed section. Runs on every `step` change, so a rail tap
  // and a URL arriving with ?step=6 take the same path.
  useEffect(() => {
    if (!open || step === null) return;
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#guide-step-${step}`);
    if (!root || !target) return;

    root.scrollTo?.({ top: target.offsetTop - root.offsetTop, behavior: 'smooth' });
  }, [open, step]);

  const handleReminder = useCallback(() => {
    openCalendarReminder(t('calendar.title'), t('calendar.details'));
  }, [t]);

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-full max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-border px-4 pb-3 pt-4 pe-12">
          <DialogTitle className="text-base">{t('header.ariaLabel')}</DialogTitle>
          <GuideRail current={step} onSelect={onGoToStep} />
        </DialogHeader>

        <div
          ref={scrollRef}
          data-guide-scroll
          className="flex max-h-[calc(90vh-7rem)] flex-col gap-4 overflow-y-auto p-4"
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
              className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 whitespace-normal rounded-2xl bg-primary px-6 py-3 text-center text-sm font-black text-primary-foreground shadow-lg"
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
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
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
