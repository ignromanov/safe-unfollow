// Preview provider chain for design-sync. Wired via cfg.extraEntries + cfg.provider.
//
// Why this exists: the app's own initI18n() is async (it lazy-loads locale chunks),
// so it cannot back a preview wrapper — previews render synchronously on first paint
// and would show raw translation keys, or throw, before the promise settles. This
// builds a synchronous i18next instance from the English locale JSON already in the
// repo. It imports those files rather than inlining copies, so it cannot drift.
//
// Router and theme are here for the same reason: components reaching for <Link> or
// useNavigate throw outside a Router, and themed components read the .dark class the
// ThemeProvider owns. MemoryRouter needs no browser history, which is what makes it
// safe in a screenshot harness.
import * as React from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { ThemeProvider } from '../src/components/theme-provider';

import common from '../src/locales/en/common.json';
import faq from '../src/locales/en/faq.json';
import hero from '../src/locales/en/hero.json';
import howto from '../src/locales/en/howto.json';
import meta from '../src/locales/en/meta.json';
import results from '../src/locales/en/results.json';
import upload from '../src/locales/en/upload.json';
import wizard from '../src/locales/en/wizard.json';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'faq', 'hero', 'howto', 'meta', 'results', 'upload', 'wizard'],
    resources: { en: { common, faq, hero, howto, meta, results, upload, wizard } },
    interpolation: { escapeValue: false },
    // Synchronous init: with all resources supplied up front there is nothing to
    // await, so the very first render already has translations.
    initImmediate: false,
    react: { useSuspense: false },
  });
}

// `children` is cast at the boundary because two copies of @types/react are
// resolvable here — the repo's v18 and the converter's own under
// .ds-sync/node_modules (reachable via the .design-sync/node_modules symlink the
// dts.mjs fork needs). Their ReactNode unions differ (v19 admits bigint), so an
// honest annotation fails typecheck against react-router's v18 signature. Previews
// are compiled by esbuild, which strips types, so this is a types-only artifact.
export function DsPreviewProvider({ children }: { children?: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        {/* forcedTheme pins light: previews are graded from screenshots, and a
            provider that resolved "system" would make every card's appearance
            depend on the capturing machine's OS setting. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
        >
          {children as never}
        </ThemeProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
}
