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

export interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
  onManualEntry: () => void;
}

export function PaywallModal({ open, onOpenChange, onCheckout, onManualEntry }: PaywallModalProps) {
  const { t } = useTranslation('results');

  const bullets = [
    t('export.paywall.bullet1'),
    t('export.paywall.bullet2'),
    t('export.paywall.bullet3'),
    t('export.paywall.bullet4'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('export.paywall.headline', { rows: FREE_EXPORT_ROWS })}</DialogTitle>
          <DialogDescription>
            {t('export.paywall.subtitle', { rows: FREE_EXPORT_ROWS })}
          </DialogDescription>
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
          <Button variant="ghost" size="sm" onClick={onManualEntry}>
            {t('export.license.havePurchase')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
