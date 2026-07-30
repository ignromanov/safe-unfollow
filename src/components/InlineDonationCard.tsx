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
    <div
      data-testid="inline-donation-card"
      className="relative rounded-3xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-5 md:p-8 animate-in fade-in duration-500"
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
          <a
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-5 py-3 md:px-6 md:py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm md:text-base shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Coffee size={18} />
            <span className="hidden md:inline">{t('donation.cta')}</span>
            <span className="md:hidden">{t('donation.ctaMobile')}</span>
          </a>
          <button
            onClick={handleDismiss}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('donation.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
