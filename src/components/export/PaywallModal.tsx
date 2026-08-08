import { Check, FileText, GitCompare } from 'lucide-react';
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

  const bullets = [
    t('export.paywall.bullet1'),
    t('export.paywall.bullet2'),
    t('export.paywall.bullet3'),
    t('export.paywall.bullet4'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* The dialog arrives together with a file the reader never asked for,
            and on iOS Safari a blob download can be silent or blocked outright.
            Naming the file is what turns the headline below from an assertion
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

        <DialogHeader>
          <DialogTitle>
            {t('export.paywall.headline', {
              rows: FREE_EXPORT_ROWS,
              total: totalRows.toLocaleString(i18n.language),
            })}
          </DialogTitle>
          {/* The anchor, not a restatement of the cap — the receipt strip above
              already names the file and the row count. Category pricing measured
              on the App Store 2026-08-08: modal Pro tiers $4.99/mo, advanced
              tiers $9.99/mo. That is a dated observation, not a standing fact.
              It compares the pricing *model* only: none of those trackers sells
              a data export, so claiming to undercut them on this feature would
              be false. */}
          <DialogDescription>{t('export.paywall.subtitle')}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {bullets.map(bullet => (
            <li key={bullet} className="flex items-start gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <ul className="space-y-2 text-sm text-muted-foreground border-t pt-4">
          <li className="flex items-center gap-2 opacity-60">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{t('export.paywall.teaserPdf')}</span>
            <span className="ms-auto text-xs uppercase tracking-wide">
              {t('export.paywall.comingSoon')}
            </span>
          </li>
          <li className="flex items-center gap-2 opacity-60">
            <GitCompare className="h-4 w-4 shrink-0" />
            <span>{t('export.paywall.teaserCompare')}</span>
            <span className="ms-auto text-xs uppercase tracking-wide">
              {t('export.paywall.comingSoon')}
            </span>
          </li>
        </ul>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          <Button onClick={onCheckout} size="lg">
            {t('export.paywall.cta')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('export.paywall.instantNote')}
          </p>
          {/* Risk reversal belongs next to the action it de-risks, not among the
              feature bullets. `dir="ltr"` on the address keeps its dot-separated
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
