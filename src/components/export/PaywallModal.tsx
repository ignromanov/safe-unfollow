import { ArrowRight, Check } from 'lucide-react';
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
 * What goes big here is the reader's own two numbers, not our price. The price
 * appears once, on the button, where it is a term of the transaction rather
 * than an argument for it — the same rule Phase 2 applied to the trigger
 * ("either the click gives you something, or the button says what it costs").
 * The click already gave them a file; a price restated as a headline would put
 * the filter back in front of the value it was just moved behind.
 *
 * The pair is also the only claim on this screen the reader can verify without
 * trusting us: the sample is in their Downloads folder and its rows can be
 * counted. That is the same property the whole product sells, applied to the
 * one screen that asks for money.
 *
 * Both labels name a state — what you hold, and what the view holds — because
 * the pair is meant to report the reader's position, not to make the offer. An
 * imperative on the right ("Get all") turns the arrow from a measure of the gap
 * into a second call to action competing with the button below, which is the
 * one thing this layout was chosen to avoid.
 *
 * Four bullets collapsed to two lines. The decision at this point is "is the
 * rest worth $7", not "which formats does it support", and a spec list reads as
 * an answer to the second question. The split between the two lines is not
 * cosmetic: the description line may be quiet, the terms line may not. "Not a
 * subscription" and the device cap exist to prevent disputes, and a dispute
 * costs $30 against $5.50 net — at current volume one of them can exceed a
 * month of revenue. That economics is what sets the terms line's contrast and
 * size; it is separated from the quiet line by colour rather than by weight,
 * because bolding a disclaimer under a call to action reads as a defence
 * against an accusation nobody has made yet.
 *
 * There is no small-view branch. `isFreeExportCapped` will not open this modal
 * below `PAYWALL_MIN_ROWS`, so the gap is always worth drawing by the time the
 * reader gets here — a suppressed-pair fallback would be code for a caller that
 * cannot exist.
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
              total: totalRows.toLocaleString(i18n.language),
            })}
          </span>
        </p>

        {/* aria-hidden: the pair is a restatement of the receipt above, which
            already gives a screen reader both numbers in a sentence. Read out a
            second time it is two bare numerals and two fragments.

            Both registers are the design system's, not hand-rolled: `font-display`
            for the numerals because the guide assigns it to every stat number —
            and it carries the -0.04em / 1.15 pairing plus the RTL reset that a
            manual `tracking-tighter` would miss in Arabic — and 12px / black /
            widest for the labels, which is the uppercase micro-label used for
            every stat label in the product. */}
        <div aria-hidden="true" className="flex items-center justify-center gap-3.5 pt-1">
          <div className="flex min-w-0 flex-col items-center gap-1">
            <span className="font-display text-5xl font-extrabold text-muted-foreground">
              {FREE_EXPORT_ROWS.toLocaleString(i18n.language)}
            </span>
            <span className="text-center text-xs font-black tracking-widest text-muted-foreground uppercase text-balance">
              {t('export.paywall.haveLabel')}
            </span>
          </div>

          {/* Logical, not visual: the arrow points from held to offered, which
              in Arabic and Hebrew is right to left. */}
          <ArrowRight className="h-6 w-6 shrink-0 mb-3.5 text-muted-foreground rtl:-scale-x-100" />

          <div className="flex min-w-0 flex-col items-center gap-1">
            <span className="font-display text-5xl font-extrabold text-primary">
              {totalRows.toLocaleString(i18n.language)}
            </span>
            <span className="text-center text-xs font-black tracking-widest text-primary uppercase text-balance">
              {t('export.paywall.getLabel')}
            </span>
          </div>
        </div>

        <DialogHeader>
          {/* Says what is being sold, and answers the unspoken "can I not just
              scroll and copy these out myself?" — the unit is a file, not a
              view. */}
          <DialogTitle className="text-center">{t('export.paywall.headline')}</DialogTitle>
          {/* Category pricing measured on the App Store 2026-08-08: modal Pro
              tiers $4.99/mo, advanced tiers $9.99/mo. A dated observation, not a
              standing fact — it needs re-checking, and there is no test that can
              do that for us. It compares the pricing *model* only: none of those
              trackers sells a data export, so claiming to undercut them on this
              feature would be false. */}
          <DialogDescription className="text-center">
            {t('export.paywall.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
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

          {/* Dispute defence, at full contrast and body size — see the class
              note above for why that is economics rather than hierarchy. */}
          <p className="text-center text-sm">{t('export.paywall.terms')}</p>

          {/* Description, and the only line here that may be quiet. "Excel and
              Google Sheets" rather than "CSV and JSON" deliberately: 85% of
              sessions are mobile and ~39% come from ID/IN/PH, where the open
              question is whether the file opens at all, not what it is encoded
              as. */}
          <p className="text-center text-xs text-muted-foreground">
            {t('export.paywall.featureLine')}
          </p>

          {/* Risk reversal belongs next to the action it de-risks, not among the
              feature lines. `dir="ltr"` on the address keeps its dot-separated
              run intact inside the Arabic sentence that surrounds it. */}
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
              it read as a rival primary action next to the CTA above it; as a
              quiet centred link it reads as what it is. Still a real button, so
              it stays keyboard-reachable inside the focus trap. `py-2` keeps the
              hit area past WCAG 2.5.8 AA without giving a third-order link more
              room than the action it sits under. */}
          <button
            type="button"
            onClick={onManualEntry}
            className="mx-auto cursor-pointer px-1 py-2 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary focus-visible:text-primary"
          >
            {t('export.license.havePurchase')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
