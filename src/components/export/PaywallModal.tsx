import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FREE_EXPORT_ROWS } from '@/lib/export/free-tier';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Where a refund request lands. A dedicated address rather than the general
 * `hello@` one: an unstated refund policy is a named driver of friendly-fraud
 * chargebacks, because the buyer can honestly say they did not know the terms —
 * and a Dodo dispute costs $30 against a $7 sale, so the refund is the cheap
 * outcome by a factor of four. Mirrored in the Terms of Service (§2.1); the two
 * must not drift apart.
 */
const REFUND_EMAIL = 'refunds@safeunfollow.app';

export interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
  onManualEntry: () => void;
  /** Name of the file just written to disk, extension included */
  savedFilename: string;
  /** Rows in the view the sample was cut from */
  totalRows: number;
}

/**
 * The paywall, reached only from a capped free export.
 *
 * The argument is a proportion, not a comparison. One number goes big — the
 * reader's own total — and a bar underneath shows what share of it the file in
 * their Downloads folder actually covers. Both are things they can check: the
 * sample is on disk and its rows can be counted, and the total is the count the
 * results header has been showing them all along. That is the same property the
 * whole product sells, applied to the one screen that asks for money.
 *
 * It replaces a two-numeral hero (`10 → 8,930`). Two numerals of equal weight
 * make the reader do the division; a bar has already done it. The price appears
 * once, on the button, where it is a term of the transaction rather than an
 * argument for it — the click already gave them a file, so a price restated as
 * a headline would put the filter back in front of the value it was just moved
 * behind.
 *
 * There is no small-view branch. `isFreeExportCapped` will not open this modal
 * below `PAYWALL_MIN_ROWS`, so the sample is always a minority of the list by
 * the time the reader gets here — a suppressed-bar fallback would be code for a
 * caller that cannot exist.
 */
export function PaywallModal({
  open,
  onOpenChange,
  onCheckout,
  onManualEntry,
  savedFilename,
  totalRows,
}: PaywallModalProps) {
  const { t, i18n } = useTranslation('results');

  // Split on the address rather than reaching for <Trans>: the address has to
  // sit mid-sentence in languages that put a postposition after it (Turkish
  // "{{email}} adresine yaz"), so appending a link to a finished sentence would
  // mistranslate. A locale that drops {{email}} is caught by the locale guard.
  const [refundBefore, refundAfter] = t('export.paywall.refund', {
    email: REFUND_EMAIL,
  }).split(REFUND_EMAIL);

  const totalLabel = totalRows.toLocaleString(i18n.language);

  // Share of the list the free file covers, as a percentage of the track. A
  // percentage rather than the pixel arithmetic the mockup used, because the
  // dialog is `max-w-[calc(100%-2rem)] sm:max-w-lg` — its track is a different
  // width on every viewport, and a figure computed against one of them would be
  // wrong on all the others.
  const samplePercent = (FREE_EXPORT_ROWS / totalRows) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bottom sheet below `sm`, the centred dialog above it. 85% of sessions
          are mobile, and a centred sheet on a phone puts the CTA in the middle
          of the screen where the thumb is not. The overrides are all `max-sm:`
          and live here rather than in `ui/dialog`: three other dialogs share
          that component and none of them asked for this geometry.

          `showCloseButton={false}` because "Not now" below is the drawn
          dismissal and two of them in a sheet this small is clutter. Escape and
          an overlay click still close it, so no input method is stranded.

          The bottom padding clears the home indicator; `p-6` alone leaves the
          last control under it on a notched device.

          The second class group is the motion, and it is not decoration: the
          base is a centred dialog, so it fades and zooms from 95%. A panel
          welded to the bottom edge that materialises in place reads as an
          overlay that happened to land there. It has to arrive from the edge it
          is attached to, or the geometry is a claim the motion contradicts.
          `zoom-in-100` and `fade-in-100` are how the inherited scale and
          opacity are cancelled — tw-animate composes one `enter` keyframe out of
          `--tw-enter-{scale,opacity,translate-y}`, so the way to remove a term
          is to set it to its identity, not to omit it.

          Safe against the centring: Tailwind v4 emits `translate-x-[-50%]` on
          the `translate` **property** while the keyframe drives `transform`, so
          the slide stacks on the centring instead of replacing it. Verified in
          the built CSS, not assumed — had they shared a property the sheet
          would have jumped half its width on open. `prefers-reduced-motion` is
          already handled globally in `styles.css`. */}
      <DialogContent
        showCloseButton={false}
        className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:duration-300 max-sm:ease-out max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:fade-in-100 max-sm:data-[state=closed]:fade-out-100"
      >
        {/* The dialog arrives together with a file the reader never asked for,
            and on iOS Safari a blob download can be silent or blocked outright.
            Naming the file is what turns everything below from an assertion
            about something unseen into a claim the reader can go and check.
            Muted and small on purpose: a receipt, not a second headline. */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
          <span className="min-w-0 break-words">
            {t('export.saved.capped', {
              filename: savedFilename,
              rows: FREE_EXPORT_ROWS,
              total: totalLabel,
            })}
          </span>
        </p>

        <DialogHeader className="gap-1 text-start sm:text-start">
          {/* The heading is the number and its label together, not a sentence
              above them. Radix names the dialog from this node, so a screen
              reader gets "8,930 accounts matched by this filter" — which is the
              same claim the sighted reader gets, rather than a headline written
              to stand in for one.

              `font-display` is the design system's register for every stat
              number in the product, and it carries the -0.04em / 1.15 pairing
              plus the RTL letter-spacing reset that a hand-rolled
              `tracking-tighter` would miss in Arabic. */}
          <DialogTitle className="flex flex-col gap-1">
            <span className="font-display text-5xl leading-none font-extrabold text-primary">
              {totalLabel}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {t('export.paywall.listLabel')}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* aria-hidden on the whole block, bar and legend together: it restates
            the sentence below it in a form that has no reading. A colour key
            read aloud is two words and a shape nobody can see, and the two
            counts are already in the receipt above.

            The floor is `max(12px, …)` and not a bare percentage. At 8,930 rows
            the true share is 0.1% — under a pixel, so the segment would vanish
            and the bar would say the sample is nothing. The floor distorts in
            the sample's favour, which is the safe direction: it can only make
            our free tier look more generous than it is. Just above
            `PAYWALL_MIN_ROWS` — the smallest list that opens this modal at all
            — the share is 32% and the floor stops applying, so the distortion
            disappears exactly where it would start to matter. */}
        <div aria-hidden="true" className="flex flex-col gap-2">
          <div className="flex h-4 overflow-hidden rounded-full border bg-muted">
            <div
              className="shrink-0 bg-emerald-500"
              style={{ width: `max(12px, ${samplePercent}%)` }}
            />
            <div className="w-0.5 shrink-0 bg-background" />
            <div className="grow bg-primary" />
          </div>
          {/* The swatches are outlined, not bare. Emerald on the light surface
              measures 2.39:1 against the 3:1 non-text threshold, and here the
              fill is the only thing tying a label to a segment — the "it is
              decorative" exemption does not apply to a key. The outline carries
              the discriminability; the fill carries the meaning. */}
          <div className="flex justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-muted-foreground bg-emerald-500" />
              {t('export.paywall.legendSample', { rows: FREE_EXPORT_ROWS })}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-muted-foreground bg-primary" />
              {t('export.paywall.legendRest')}
            </span>
          </div>
        </div>

        {/* The one line that has to stand without the bar, because the bar is
            hidden from assistive technology. It states the boundary as a row
            number and the offer as a total, so the proportion survives being
            read out. "Not a subscription" is in this sentence rather than in the
            quiet band below: it is a dispute defence, and a dispute costs $30
            against $5.50 net — at current volume one of them can exceed a month
            of revenue.

            `DialogDescription` rather than a bare `<p>`, and that is not a
            formality: Radix points `aria-describedby` at it, so the sentence
            that replaces the bar for a screen reader is also the one the dialog
            announces itself with. Without it Radix warns, and the reader who
            most needs this line gets the receipt and nothing else. Placed after
            the bar because that is where it reads; the wiring is by id, not by
            document order. Not muted — the default `text-muted-foreground` is
            for descriptions that repeat the title, and this one carries the
            offer. */}
        <DialogDescription className="text-sm text-foreground">
          {t('export.paywall.gap', { rows: FREE_EXPORT_ROWS, total: totalLabel })}
        </DialogDescription>

        {/* `sm:space-x-0` is not cosmetic: the footer's own class list carries
            `sm:space-x-2` for the horizontal row it normally is, and that rule
            puts an inline margin on every child but the first. Left in place, the
            two buttons and the terms block sit 8px off the receipt above them
            from 640px up — a misalignment nothing in jsdom can see. */}
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch sm:space-x-0">
          {/* Three classes the variant does not give, each from a written rule
              rather than taste. `min-h-11`: `size="lg"` is `h-10`, i.e. 40px,
              under the 44px touch target the mobile contract sets — and 85% of
              sessions are mobile, on the highest-value button in the product.
              `rounded-2xl`: the app lives at the large end of the radius scale;
              the variant's `rounded-md` is the shadcn default nothing else here
              uses. The coloured `shadow-2xl` is the one heavy shadow in the
              product and the guide reserves it for primary CTAs — Hero and
              FooterCTA are its only other wearers, which is the company this
              button belongs in. */}
          <Button
            onClick={onCheckout}
            size="lg"
            className="min-h-11 rounded-2xl font-semibold shadow-2xl shadow-primary/30"
          >
            {t('export.paywall.cta')}
          </Button>

          {/* Leaving is a legitimate outcome here — 56.7% of readers take it —
              so it gets a real control instead of only a corner glyph. Routed
              through `onOpenChange` so it counts as the same dismissal Escape
              and the overlay already record; a second event name for the same
              intent would split the series. */}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-2xl font-semibold text-muted-foreground"
          >
            {t('export.paywall.dismiss')}
          </Button>

          <div className="flex flex-col gap-1.5 border-t pt-3.5">
            {/* The only place the buyer is given something to compare $7
                against. Category pricing measured on the App Store 2026-08-08:
                modal Pro tiers $4.99/mo, advanced tiers $9.99/mo. A dated
                observation, not a standing fact. It compares the pricing *model*
                only: none of those trackers sells a data export, so claiming to
                undercut them on this feature would be false.

                Quiet, and below the CTA rather than under the headline, because
                the argument this screen makes is the proportion above. The
                anchor is the answer to a question the reader may not ask. */}
            <p className="text-center text-xs text-muted-foreground">
              {t('export.paywall.subtitle')}
            </p>

            {/* The device cap. Stated because it is real and used to be stated
                nowhere: a buyer met it for the first time as a `limit_reached`
                error on their fourth device, which is a dispute at roughly five
                sales each. */}
            <p className="text-center text-xs text-muted-foreground">{t('export.paywall.terms')}</p>

            {/* Risk reversal belongs next to the action it de-risks, not among
                the feature lines. `dir="ltr"` on the address keeps its
                dot-separated run intact inside the Arabic sentence around it. */}
            <p className="text-center text-xs text-muted-foreground">
              {refundBefore}
              <a
                dir="ltr"
                href={`mailto:${REFUND_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                {REFUND_EMAIL}
              </a>
              {refundAfter}
            </p>

            {/* A recovery path, not a second offer. As a full-width ghost button
                it read as a rival primary action; as a quiet centred link it
                reads as what it is. Still a real button, so it stays
                keyboard-reachable inside the focus trap. `py-2` keeps the hit
                area past WCAG 2.5.8 AA without giving a third-order link more
                room than the action it sits under. */}
            <button
              type="button"
              onClick={onManualEntry}
              className="mx-auto cursor-pointer px-1 py-2 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary focus-visible:text-primary"
            >
              {t('export.license.havePurchase')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
