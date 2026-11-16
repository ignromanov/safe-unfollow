import { X } from 'lucide-react';
import { useEffect } from 'react';

import { RTL_LANGUAGES, type SupportedLanguage } from '@/config/languages';
import { LOCALE_HINT_COPY } from '@/config/locale-hint-copy';
import { dismissLocaleHint } from '@/lib/locale-hint';
import { localeHintTelemetry } from '@/lib/stats/locale-hint-events';
import { persistLanguageSync } from '@/lib/store';

interface LocaleHintBannerProps {
  target: SupportedLanguage;
  href: string;
  path: string;
  onDismiss: () => void;
}

/**
 * Fixed at the top, so it moves no layout (no CLS) and stays clear of the AdSense anchor and
 * vignette, which take the bottom of the screen. `translate="no"` and `lang` keep the
 * translator that summoned it from rewriting words already in its target language.
 */
export default function LocaleHintBanner({ target, href, path, onDismiss }: LocaleHintBannerProps) {
  const copy = LOCALE_HINT_COPY[target];

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
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-lg">
        <span>{copy.text}</span>
        <a
          href={href}
          onClick={() => {
            // Before the navigation: the store persists asynchronously, and the next document
            // would read the old language (store.ts).
            persistLanguageSync(target);
            localeHintTelemetry.click(target, path);
          }}
          className="shrink-0 font-semibold text-primary-strong underline"
        >
          {copy.open}
        </a>
        <button
          type="button"
          aria-label={copy.close}
          onClick={() => {
            dismissLocaleHint();
            onDismiss();
          }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
