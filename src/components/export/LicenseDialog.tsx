import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { LicenseFailureReason } from '@/lib/export/license';
import { activateLicense, isLicenseKeyFormat } from '@/lib/export/license';
import { storeLicense } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Key carried by the checkout redirect; null means "ask the user for it". */
  initialKey: string | null;
  source: 'redirect' | 'manual';
}

type DialogState =
  | { kind: 'form' }
  | { kind: 'activating' }
  | { kind: 'error'; reason: LicenseFailureReason | 'format' };

// 'disabled' maps to the "revoked" copy, not "not found" — telling someone
// whose license was disabled that we "could not find" their key sends them
// hunting through their purchase email for a typo that does not exist.
// `as const` keeps the literal dot-paths so `t()` can type-check them below.
const ERROR_KEYS = {
  format: 'export.license.errorFormat',
  not_found: 'export.license.errorNotFound',
  limit_reached: 'export.license.errorLimit',
  disabled: 'export.license.revoked',
  invalid_input: 'export.license.errorGeneric',
  network: 'export.license.errorGeneric',
  unknown: 'export.license.errorGeneric',
} as const satisfies Record<LicenseFailureReason | 'format', string>;

/**
 * Activation surface for both entry points: the post-checkout redirect (key in
 * hand, activate on mount) and manual entry on a second device.
 *
 * This is the only place in the app where a paid user can be left with nothing
 * after handing over money, so every failure path ends in a visible message and
 * a retry rather than a console error.
 */
export function LicenseDialog({ open, onOpenChange, initialKey, source }: LicenseDialogProps) {
  const { t } = useTranslation('results');
  const [state, setState] = useState<DialogState>(
    initialKey === null ? { kind: 'form' } : { kind: 'activating' }
  );
  const [inputValue, setInputValue] = useState('');

  const runActivation = useCallback(
    async (key: string): Promise<void> => {
      setState({ kind: 'activating' });

      const result = await activateLicense(key);

      if (result.ok) {
        storeLicense(key.trim(), result.instanceId);
        if (source === 'redirect') {
          analytics.purchaseSuccess();
        } else {
          analytics.licenseRestored();
        }
        onOpenChange(false);
        return;
      }

      analytics.licenseError(result.reason);
      setState({ kind: 'error', reason: result.reason });
    },
    [onOpenChange, source]
  );

  useEffect(() => {
    if (initialKey === null) return;
    void runActivation(initialKey);
  }, [initialKey, runActivation]);

  const handleSubmit = (): void => {
    if (!isLicenseKeyFormat(inputValue)) {
      setState({ kind: 'error', reason: 'format' });
      return;
    }
    void runActivation(inputValue);
  };

  const handleRetry = (): void => {
    if (initialKey !== null) {
      void runActivation(initialKey);
      return;
    }
    setState({ kind: 'form' });
  };

  const isActivating = state.kind === 'activating';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('export.license.title')}</DialogTitle>
          {initialKey === null ? (
            <DialogDescription>{t('export.license.manualDescription')}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {isActivating ? t('export.license.activating') : ''}
        </div>

        {state.kind === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            {t(ERROR_KEYS[state.reason])}
          </p>
        ) : null}

        {initialKey === null && state.kind !== 'activating' ? (
          <Input
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            placeholder={t('export.license.placeholder')}
            aria-label={t('export.license.title')}
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          {isActivating ? (
            <Button size="lg" disabled aria-busy>
              <div className="animate-spin">
                <Loader2 className="h-4 w-4" />
              </div>
              {t('export.license.activating')}
            </Button>
          ) : null}

          {!isActivating && initialKey === null ? (
            <Button size="lg" onClick={handleSubmit}>
              {t('export.license.submit')}
            </Button>
          ) : null}

          {!isActivating && initialKey !== null && state.kind === 'error' ? (
            <Button size="lg" onClick={handleRetry}>
              {t('export.license.retry')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
