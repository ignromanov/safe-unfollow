import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import type { SupportedLanguage } from '@/config/languages';
import { isLocaleHintDismissed, localeHintHref, translationTarget } from '@/lib/locale-hint';
import { useAppStore } from '@/lib/store';

// The banner, its copy in ten languages and its events load only once a translator is seen:
// most readers never trigger it, and the entry chunk is held to a byte budget.
const LocaleHintBanner = lazy(() => import('./LocaleHintBanner'));

/**
 * Watches <html> for a page translator and, on a page the hint belongs on, offers the page
 * we already publish in the translator's target language. See lib/locale-hint.ts.
 */
export function LocaleHint({ lang }: { lang: SupportedLanguage }) {
  const { pathname } = useLocation();
  // Never mid-parse: a navigation there would abandon the export being read.
  const parsing = useAppStore(s => s.uploadStatus === 'loading');
  const [target, setTarget] = useState<SupportedLanguage | null>(null);
  const [dismissed, setDismissed] = useState(isLocaleHintDismissed);

  useEffect(() => {
    if (dismissed) return;
    const html = document.documentElement;
    const read = () => setTarget(translationTarget(html, lang));
    read();
    // The translator arrives after hydration, and only rewrites attributes on <html>.
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ['class', 'lang'] });
    return () => observer.disconnect();
  }, [lang, dismissed]);

  const href = target === null ? null : localeHintHref(pathname, target);
  if (dismissed || parsing || target === null || href === null) return null;

  return (
    <Suspense fallback={null}>
      <LocaleHintBanner
        target={target}
        href={href}
        path={pathname}
        onDismiss={() => setDismissed(true)}
      />
    </Suspense>
  );
}
