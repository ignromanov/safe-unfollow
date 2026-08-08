import { useEffect, useRef } from 'react';
import { Shield, Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { analytics } from '@/lib/analytics';
import { useDonationCardDismiss } from '@/hooks/useDonationCardDismiss';

const BMC_URL = 'https://www.buymeacoffee.com/ignromanov';
const SESSION_KEY = 'donation_card_shown';

interface InlineDonationCardProps {
  accountCount: number;
  isSample?: boolean;
}

export function InlineDonationCard({ accountCount, isSample = false }: InlineDonationCardProps) {
  const { t } = useTranslation('results');
  const { isDismissed, dismiss } = useDonationCardDismiss();
  const impressionTrackedRef = useRef(false);

  useEffect(() => {
    if (!isSample && !isDismissed && !impressionTrackedRef.current) {
      impressionTrackedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, 'true');
      analytics.donationCardImpression(accountCount);
    }
  }, [isSample, isDismissed, accountCount]);

  if (isSample || isDismissed) return null;

  const handleClick = () => {
    analytics.donationCardClick(accountCount);
  };

  const handleDismiss = () => {
    analytics.donationCardDismiss(accountCount);
    dismiss();
  };

  return (
    // Quiet surface, deliberately. This card was the loudest thing on /results —
    // double-weight indigo border, gradient wash, an entrance animation and a
    // filled-primary CTA — while the export trigger beside it was a grey
    // outline. One sale nets $5.50; a month of all the advertising on this
    // property nets about $4.90. The visual hierarchy was the inverse of the
    // revenue, and Apple HIG allows one primary action per screen. Nothing is
    // wrong with the ask, so nothing about the ask changed: only its weight.
    <div
      data-testid="inline-donation-card"
      className="relative rounded-3xl border border-border bg-muted p-5 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        {/* Icon */}
        <div className="hidden md:flex shrink-0 p-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40">
          <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          {/* Desktop */}
          <p className="hidden md:block text-lg font-bold text-zinc-900 dark:text-white">
            {t('donation.headline', { count: accountCount })}
          </p>
          <p className="hidden md:block text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {t('donation.body')}
          </p>
          {/* Mobile */}
          <p className="md:hidden text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            {t('donation.headlineMobile')}
          </p>
          <p className="md:hidden text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {t('donation.bodyMobile')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Secondary weight, still plainly a control: a bordered surface that
              sits above the card, a brand-tinted hover, the pressed scale it
              always had, and an explicit focus ring copied from the Button
              component. Quiet is not inert.

              Not switched to <Button variant="outline"> despite the smaller
              diff: that variant pairs `hover:text-accent-foreground` with
              `dark:hover:bg-input/50`, which puts near-black text on a near-
              black fill — 1.10:1 in dark mode on hover. See the report; the
              variant needs fixing in ui/button.tsx, not working around here. */}
          <a
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition-all outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/80 active:scale-95 md:px-6 md:py-3.5 md:text-base"
          >
            <Coffee size={18} />
            <span className="hidden md:inline">{t('donation.cta')}</span>
            <span className="md:hidden">{t('donation.ctaMobile')}</span>
          </a>
          {/* Retinted, not restyled. The card's background moved out from under
              this control, and `text-zinc-400` on the new muted surface
              measures 2.28:1 in light mode — it was already the palest text
              here and would have become unreadable. Reuses the pair the body
              copy already uses (6.88:1 / 6.25:1) rather than introducing a
              fourth grey. */}
          <button
            onClick={handleDismiss}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('donation.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
