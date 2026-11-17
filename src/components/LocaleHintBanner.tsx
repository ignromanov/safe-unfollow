import { X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/config/languages';
import { LOCALE_HINT_COPY } from '@/config/locale-hint-copy';
import { dismissLocaleHint } from '@/lib/locale-hint';
import { localeHintTelemetry } from '@/lib/stats/locale-hint-events';
import { persistLanguageSync } from '@/lib/store';
import { useBottomAnchorInset } from '@/lib/bottom-anchor-inset';

interface LocaleHintBannerProps {
  target: SupportedLanguage;
  href: string;
  path: string;
  onDismiss: () => void;
}

/**
 * Fixed at the bottom, where a thumb reaches it on a phone, so it moves no layout (no CLS).
 * z-[85] puts it above the sticky header (Header.tsx, z-[80]) and below dialogs (z-[90]). It
 * clears the home indicator by the safe-area inset, and rises above an AdSense bottom anchor
 * when one is showing (lib/bottom-anchor-inset.ts), since the ad may not be covered. On a phone
 * the action is a full-width button under the text; from `sm` up it is one row. Both controls
 * are 44px touch targets. `translate="no"` and `lang` keep the translator that summoned it from
 * rewriting words already in its target language.
 */
export default function LocaleHintBanner({ target, href, path, onDismiss }: LocaleHintBannerProps) {
  const copy = LOCALE_HINT_COPY[target];
  const bottom = useBottomAnchorInset();

  useEffect(() => {
    localeHintTelemetry.view(target, path);
  }, [target, path]);

  return (
    <div
      translate="no"
      lang={target}
      dir={RTL_LANGUAGES.includes(target) ? 'rtl' : 'ltr'}
      role="region"
      aria-label={copy.text}
      style={{ bottom }}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[85] flex justify-center px-3 pt-3 sm:px-4 ${
        bottom === 0 ? 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]' : 'pb-3'
      }`}
    >
      <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:rounded-xl sm:py-2 sm:pe-2 sm:ps-4">
        <div className="flex items-start gap-2 sm:contents">
          <p className="flex-1 pt-2.5 text-base leading-snug sm:pt-0 sm:text-sm">{copy.text}</p>
          <button
            type="button"
            aria-label={copy.close}
            onClick={() => {
              dismissLocaleHint();
              localeHintTelemetry.dismiss(target, path);
              onDismiss();
            }}
            className="-me-2 -mt-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-last sm:m-0"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <Button asChild className="min-h-11 w-full text-base sm:w-auto sm:text-sm">
          <a
            href={href}
            onClick={() => {
              // Before the navigation: the store persists asynchronously, and the next document
              // would read the old language (store.ts).
              persistLanguageSync(target);
              localeHintTelemetry.click(target, path);
            }}
          >
            {copy.open}
          </a>
        </Button>
      </div>
    </div>
  );
}
