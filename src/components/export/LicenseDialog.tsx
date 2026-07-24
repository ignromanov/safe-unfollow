import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getStoredLicense, storeLicense } from '@/lib/export/unlock';
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

// not_found, limit_reached and disabled are permanent verdicts from
// LemonSqueezy — the same key fails the same way forever, so offering
// "Try again" for those reasons would just invite a click that cannot help.
const RETRYABLE_REASONS = new Set<LicenseFailureReason | 'format'>([
  'invalid_input',
  'network',
  'unknown',
]);

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
  // A redirect URL can carry `?license=` with nothing after it — treat that
  // the same as "no key" (show the manual form) rather than activating an
  // empty string and paying for a network round-trip to learn what a regex
  // already knew.
  const activationKey = initialKey?.trim() ?? '';
  const hasActivationKey = activationKey.length > 0;
  const [state, setState] = useState<DialogState>(
    hasActivationKey ? { kind: 'activating' } : { kind: 'form' }
  );
  const [inputValue, setInputValue] = useState('');
  // Guards the automatic mount activation independently of runActivation's
  // identity: activateLicense() is not idempotent (LemonSqueezy mints a new
  // device instance, capped at 3, on every call), so this must not re-fire
  // just because a parent re-render gave onOpenChange a new closure.
  const activatedKeyRef = useRef<string | null>(null);

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
    if (!hasActivationKey) return;
    if (activatedKeyRef.current === activationKey) return;
    activatedKeyRef.current = activationKey;

    // activateLicense() is not idempotent — it mints a new device instance
    // every call, capped at 3 per key. If this device already holds this
    // exact key, re-clicking the receipt-email link must not spend another
    // activation: it would eventually lock the buyer out of their own phone.
    const stored = getStoredLicense();
    if (stored?.key === activationKey) {
      onOpenChange(false);
      return;
    }

    void runActivation(activationKey);
  }, [activationKey, hasActivationKey, onOpenChange, runActivation]);

  const handleSubmit = (): void => {
    if (!isLicenseKeyFormat(inputValue)) {
      setState({ kind: 'error', reason: 'format' });
      return;
    }
    void runActivation(inputValue);
  };

  const handleRetry = (): void => {
    if (hasActivationKey) {
      void runActivation(activationKey);
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
          <DialogDescription>
            {hasActivationKey
              ? // Stable purpose text, not state text: the role="status" region
                // below already announces "Activating…" on state change, so
                // repeating it here would have a screen reader read it twice.
                t('export.paywall.instantNote')
              : t('export.license.manualDescription')}
          </DialogDescription>
        </DialogHeader>

        <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {isActivating ? t('export.license.activating') : ''}
        </div>

        {state.kind === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            {t(ERROR_KEYS[state.reason])}
          </p>
        ) : null}

        {!hasActivationKey && state.kind !== 'activating' ? (
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

          {!isActivating && !hasActivationKey ? (
            <Button size="lg" onClick={handleSubmit}>
              {t('export.license.submit')}
            </Button>
          ) : null}

          {!isActivating &&
          hasActivationKey &&
          state.kind === 'error' &&
          RETRYABLE_REASONS.has(state.reason) ? (
            <Button size="lg" onClick={handleRetry}>
              {t('export.license.retry')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
