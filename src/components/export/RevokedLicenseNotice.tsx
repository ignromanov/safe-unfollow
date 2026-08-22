import { useTranslation } from 'react-i18next';

import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SUPPORT_EMAIL } from '@/lib/export/support-email';

/**
 * The body shown when a license is permanently unusable — disabled, refunded, or
 * simply not found. Shared between `LicenseDialog`'s activation failure and
 * `ExportDialog`'s mid-session revocation check, because both describe the exact
 * same situation: the reader is looking at a key the server will never accept
 * again, and the one action that can resolve it is emailing support.
 */
export function RevokedLicenseNotice() {
  const { t } = useTranslation('results');

  return (
    <div role="alert" className="flex flex-col gap-3">
      <DialogHeader className="text-start sm:text-start">
        <DialogTitle>{t('export.license.revokedTitle')}</DialogTitle>
        <DialogDescription>
          {t('export.license.revokedBody', { email: SUPPORT_EMAIL })}
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}

/**
 * The one action a terminal license state can offer. Styled to match the
 * paywall's primary CTA (`rounded-2xl font-bold`) since it sits in the same
 * sheet — including the `hover:`/`focus-visible:` states a real `Button`
 * gets for free, which a hand-rolled anchor does not.
 */
export function SupportMailtoLink() {
  const { t } = useTranslation('results');

  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Pro Export licence')}`}
      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/80 focus-visible:ring-[3px]"
    >
      {t('export.license.emailSupport')}
    </a>
  );
}
