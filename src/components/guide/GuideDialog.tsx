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
function useSectionsInView(root: HTMLDivElement | null, enabled: boolean) {
  const [inView, setInView] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
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
          // every section to say nothing changed.
          return next ?? previous;
        });
      },
      { root, rootMargin: '200px 0px' }
    );

    for (const node of stepOf.keys()) observer.observe(node);
    return () => observer.disconnect();
  }, [root, enabled]);

  return inView;
}

/**
 * Which section the reader is actually in, for the rail's fill and its
 * "Step N of <total>" label — a different question from `useSectionsInView` above, which
 * asks what to preload. That one uses a 200px margin because video wants
 * advance notice; this one shrinks the root to a thin band near its top edge
 * (`-70%` off the bottom) because a section 200px below the fold is not the
 * one being read. Sharing one observer's tuning between the two questions
 * would make either the preload late or the rail wrong.
 *
 * Deliberately not written to the URL (an earlier design did this and was
 * rejected — the scroll-to-`step` effect above depends on `step`, so an
 * observer-driven write would re-enter it and fight the reader's own
 * scrolling). This is component state; the URL's `step` is only the fallback
 * for the frame before the first callback arrives.
 */
function useActiveStep(root: HTMLDivElement | null, enabled: boolean) {
  const [active, setActive] = useState<number | null>(null);
  // The full set of sections currently inside the band — the callback only
  // ever reports what *changed*, so the running total has to be kept here.
  const intersectingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || !root || typeof IntersectionObserver === 'undefined') {
      // Reset on close: the next opening should show the URL's `step` for
      // its first frame, not whatever section a previous visit ended on.
      intersectingRef.current = new Set();
      setActive(null);
      return;
    }

    const stepOf = new Map<Element, number>();
    for (const step of GUIDE_STEPS) {
      const node = root.querySelector(`#${guideStepAnchorId(step.id)}`);
      if (node) stepOf.set(node, step.id);
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = stepOf.get(entry.target);
          if (id === undefined) continue;
          if (entry.isIntersecting) intersectingRef.current.add(id);
          else intersectingRef.current.delete(id);
        }
        // Several sections can share the band for a frame (a short one, or
        // a fast scroll); the topmost — lowest id — is the one the reader's
        // attention is on. An empty set (between sections, or the observer's
        // startup batch) keeps the last known section rather than blanking
        // the rail.
        if (intersectingRef.current.size > 0) {
          setActive(Math.min(...intersectingRef.current));
        }
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    for (const node of stepOf.keys()) observer.observe(node);
    return () => observer.disconnect();
  }, [root, enabled]);

  return active;
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
// `source` is still part of the props contract but no longer read here: it
// was only ever consumed by the entry-CTA gate this component used to have,
// removed because it hid the guide's one link to Meta's profile picker
// behind four of the six ways into this dialog. Kept on the interface (not
// renamed away, not deleted) for PR 4 of this series, which is scheduled to
// emit a `guide_open` event carrying it — see progress.md.
export function GuideDialog({
  open,
  step,
  source: _source,
  onGoToStep,
  onClose,
}: GuideDialogProps) {
  const { t } = useTranslation('wizard');
  // A callback ref, not `useRef` + `.current`: Radix's Portal (the thing that
  // actually mounts this div) gates on its own `useState(false)`, flipped by
  // a `useLayoutEffect` on its first render — so on the very commit this div
  // is born, an effect elsewhere in this component that reads a plain ref's
  // `.current` synchronously would still see null, and (with no dependency
  // that ever changes again) would never get a second chance to look. A
  // callback ref turns "the node exists" into a value React hands the
  // hooks below at the exact commit it becomes true, instead of a timing
  // assumption every reader of this file has to hold in their head.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const inView = useSectionsInView(scrollEl, open);
  const activeStep = useActiveStep(scrollEl, open);
  // Whether this opening has already scrolled once. Reset on close, so the
  // next opening arrives with the same 'auto' jump rather than inheriting
  // the 'smooth' behaviour a rail tap earns later in the same session.
  const hasArrivedRef = useRef(false);
  // Forces the arrival effect below to re-run even when `step` is unchanged —
  // needed because a rail tap on the section the reader is already at (by
  // the URL's account) would otherwise be a no-op scroll.
  const [scrollNonce, setScrollNonce] = useState(0);

  const scrollToStep = useCallback(
    (target: number, behavior: ScrollBehavior) => {
      const section = scrollEl?.querySelector<HTMLElement>(`#${guideStepAnchorId(target)}`);
      if (!scrollEl || !section) return;

      // scroll-margin-top (the `scroll-mt-4` this replaced) is honoured by
      // scrollIntoView and scroll-snap, not by a manual scrollTo — so the 16px
      // gap is subtracted here instead, where it actually takes effect.
      scrollEl.scrollTo?.({ top: section.offsetTop - scrollEl.offsetTop - 16, behavior });

      // A deep link or a rail tap moves the viewport, but Radix leaves focus
      // wherever it put it on open (the first rail button) — a keyboard or
      // screen-reader user needs focus to agree with what they're now seeing.
      section.querySelector<HTMLElement>('h3')?.focus();
    },
    [scrollEl]
  );

  // Scroll to the claimed section. Runs on every `step` change (a rail tap
  // and a URL arriving with ?step=6 take the same path) and on scrollNonce
  // (a rail tap that doesn't change `step` at all).
  useEffect(() => {
    if (!open) {
      hasArrivedRef.current = false;
      return;
    }
    // `!scrollEl` is what keeps hasArrivedRef honest. The callback ref makes
    // this effect run TWICE per opening — once on the commit where Radix's
    // Portal has not attached the container yet, once when it has — and the
    // first of those scrolls nothing. Without this guard the flag would be
    // set by the run that did nothing, so the run that actually scrolls
    // would read `true` and animate: `?step=6` would smooth-scroll past five
    // sections on arrival, which is the exact layout shift the line below
    // exists to avoid.
    if (step === null || !scrollEl) return;

    // The first scroll of an opening jumps straight there; animating past
    // several sections' worth of pixels on arrival is a self-inflicted
    // layout shift. A later rail tap, within the same opening, animates.
    scrollToStep(step, hasArrivedRef.current ? 'smooth' : 'auto');
    hasArrivedRef.current = true;
  }, [open, step, scrollNonce, scrollEl, scrollToStep]);

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
        // 90svh, not 90vh: iOS resolves a bare vh to the LARGE viewport (URL
        // bar hidden), so while the bar is showing the cap is taller than
        // what's actually visible and a dialog centred in that space loses
        // content at both ends. svh tracks the space that's really there.
        //
        // max-w-[calc(100%-2rem)] has to be restated here, not dropped: it is
        // ui/dialog.tsx's own base value for exactly this gutter, but cn()
        // (tailwind-merge) resolves the whole max-w group to whichever class
        // comes last, and an unconditional max-w-2xl here silently replaced
        // it — edge to edge at a 390px width, no gutter for shadow-2xl's
        // shadow or the rounded-3xl corners to sit inside.
        className="flex max-h-[90svh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-border px-4 pb-3 pt-4 pe-12">
          <DialogTitle className="text-base">
            {t('entry.accordion.trigger', { count: GUIDE_STEPS.length })}
          </DialogTitle>
          {/* activeStep is what the observer has actually seen; step (the
              URL's claim) only covers the one frame before its first
              callback arrives. */}
          <GuideRail current={activeStep ?? step} onSelect={handleRailSelect} />
        </DialogHeader>

        <div
          ref={setScrollEl}
          data-guide-scroll
          // tabIndex/role/aria-label: Chrome makes an overflow container
          // focusable by default, Firefox and Safari do not — and the sections
          // inside hold exactly one focusable element between them (step 1's
          // Accounts Center link, GuideStepSection renders it from
          // `step.externalLink`), so without this a keyboard user reaches that
          // one link and then the footer buttons, and can never focus the
          // container to scroll the rest.
          tabIndex={0}
          role="group"
          aria-label={t('entry.accordion.trigger', { count: GUIDE_STEPS.length })}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* No standalone Accounts Center button above the sections any more:
              it was here because "go to Accounts Center" was not a step, and
              four of the six ways into this dialog opened with no way to reach
              it. It is section 1 now, first in this scroll and numbered, so a
              button repeating it here would be the third copy of one link in
              one dialog. */}
          {GUIDE_STEPS.map(guideStep => (
            <GuideStepSection
              key={guideStep.id}
              step={guideStep}
              isInView={inView.has(guideStep.id)}
            />
          ))}

          {/* The guide cannot end in "upload it now": Instagram sends the file
              in 5-30 minutes and the reader has nothing to upload yet — but
              it also can't end in a reminder for a request the reader has
              not sent, so Accounts Center is what takes the primary weight
              here, same as at the top of the scroll. The reminder is real
              and useful, just second: a reader who has just finished reading
              hasn't asked Instagram for anything yet, and a reminder set
              before that ask fires against an empty inbox. */}
          <div className="flex shrink-0 flex-col gap-3 rounded-3xl border border-border bg-card p-4">
            <a
              href={ACCOUNTS_CENTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.linkClick('meta_accounts')}
              className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-center text-sm font-black text-primary-foreground shadow-lg"
            >
              {t('entry.cta')} <ExternalLink size={18} className="shrink-0" aria-hidden="true" />
            </a>
            {/* Secondary weight, still plainly a control — same bordered
                treatment as InlineDonationCard's "Buy me a coffee": a
                bordered surface above the card, a brand-tinted hover, no
                fill. Not `variant="outline"` from ui/button.tsx — that
                variant's hover pairs near-black text on a near-black fill in
                dark mode; see InlineDonationCard's own note. */}
            <button
              type="button"
              onClick={handleReminder}
              className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-primary/10"
            >
              <Calendar size={18} aria-hidden="true" />
              {t('calendar.addReminder')}
            </button>
            {/* Ghost, but the same 48px box as the two above it. It used to
                be a bare line of text: the only one of the three controls
                without a min-height, so a reader at the bottom of the scroll
                saw two buttons and a grey caption. Same size, less ink, is
                what keeps it readable as a control without making it compete
                with the CTA — and the hover is neutral (`bg-muted`) rather
                than brand-tinted, because leaving is not one of the two
                things this card is asking for. */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
