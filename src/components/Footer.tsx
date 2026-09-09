import { useState, useEffect } from 'react';
import { Heart, Coffee, EyeOff, Eye, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { analytics, isTrackingOptedOut, optOutOfTracking, optIntoTracking } from '@/lib/analytics';
import { useStoreSSR } from '@/hooks/useStoreSSR';
import { Logo } from './Logo';
import { PrefixedLink } from './PrefixedLink';

/**
 * The GitHub mark, inline rather than from lucide-react.
 *
 * lucide 1.x removed brand icons as a category: `Github` is not merely renamed, no
 * identifier containing that string exists in 1.41.0's declarations, while `Shield` still
 * does — so the absence is the package's decision, not a failed probe. Every future major
 * would have to be checked for it again, and a logo is the one icon a general icon set has
 * a trademark reason to keep dropping.
 *
 * The path data is copied verbatim from `lucide-react@0.544.0/dist/esm/icons/github.js`,
 * and the attributes are lucide's own defaults, so this renders the glyph the footer
 * already shipped. It stays `aria-hidden`: the link's accessible name is its text, which is
 * what PrivacyPolicy.test.tsx and TermsOfService.test.tsx match on.
 */
function GithubMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function Footer() {
  const { t } = useTranslation('common');
  // The prerendered footer says the Instagram export never leaves the browser; the count
  // replaces it only once the store is readable. Previously gated behind this component's
  // own `mounted` flag. Both branches render into the same node, so they must agree on
  // register in locales that have one — see `analyzedCount` in ru/tr common.json.
  const accountCount = useStoreSSR(s => s.fileMetadata?.accountCount, undefined);

  // Not a hydration gate: `isOptedOut` is false until the effect reads localStorage, so
  // the prerendered branch is the initial value itself.
  const [isOptedOut, setIsOptedOut] = useState(false);
  useEffect(() => setIsOptedOut(isTrackingOptedOut()), []);

  const handleTrackingToggle = () => {
    if (isOptedOut) {
      optIntoTracking(); // This will reload the page
    } else {
      optOutOfTracking();
      setIsOptedOut(true);
    }
  };

  return (
    <footer className="mt-12 lg:mt-20 border-t border-border bg-card py-10 lg:py-14">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-20">
          {/* Logo & Description */}
          <div className="text-center lg:text-start">
            <div className="font-bold text-2xl mb-6 flex items-center justify-center lg:justify-start gap-4 group">
              <Logo
                size={56}
                className="lg:w-16 lg:h-16 shadow-2xl group-hover:rotate-12 transition-transform"
              />
              <span className="text-3xl lg:text-5xl font-display font-extrabold tracking-tight leading-none">
                SafeUnfollow<span className="text-primary">.app</span>
              </span>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-base lg:text-lg leading-relaxed font-medium mx-auto lg:mx-0">
              {t('footer.description')}
            </p>
          </div>

          {/* Links & Support */}
          <div className="flex flex-col items-center lg:items-end gap-8">
            {/* Navigation Links */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-x-12 gap-y-6 text-xs lg:text-sm font-black uppercase tracking-widest text-zinc-400">
              <PrefixedLink
                to="/privacy"
                className="hover:text-primary transition-colors py-2 px-1 cursor-pointer"
                onClick={() => analytics.linkClick('privacy-policy')}
              >
                {t('footer.privacyPolicy')}
              </PrefixedLink>
              <PrefixedLink
                to="/terms"
                className="hover:text-primary transition-colors py-2 px-1 cursor-pointer"
                onClick={() => analytics.linkClick('terms-of-service')}
              >
                {t('footer.termsOfService')}
              </PrefixedLink>
              <a
                href="https://safeunfollow.app/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors py-2 px-1 flex items-center gap-1.5 cursor-pointer"
                onClick={() => analytics.linkClick('docs')}
              >
                <BookOpen size={14} aria-hidden="true" />
                {t('footer.docs')}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              <a
                href="https://safeunfollow.app/docs/troubleshooting"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors py-2 px-1 cursor-pointer"
                onClick={() => analytics.linkClick('docs-troubleshooting')}
              >
                {t('footer.troubleshooting')}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              <a
                href="https://safeunfollow.app/docs/accessibility"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors py-2 px-1 cursor-pointer"
                onClick={() => analytics.linkClick('docs-accessibility')}
              >
                {t('footer.accessibility')}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              <a
                href="mailto:hello@safeunfollow.app"
                className="hover:text-primary transition-colors py-2 px-1 cursor-pointer"
              >
                {t('footer.contact')}
              </a>
              <button
                onClick={handleTrackingToggle}
                className={`cursor-pointer hover:text-primary transition-colors py-2 px-1 flex items-center gap-1.5 ${
                  isOptedOut ? 'text-emerald-500' : ''
                }`}
                title={isOptedOut ? t('footer.trackingDisabled') : t('footer.trackingEnabled')}
                suppressHydrationWarning
              >
                {/* Wrap children in spans with suppressHydrationWarning (shallow!) */}
                <span suppressHydrationWarning>
                  {isOptedOut ? <Eye size={14} /> : <EyeOff size={14} />}
                </span>
                <span suppressHydrationWarning>
                  {isOptedOut ? t('footer.trackingOff') : t('footer.dontTrackMe')}
                </span>
              </button>
              <a
                href="https://github.com/ignromanov/safe-unfollow"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors py-2 px-1 flex items-center gap-1.5 cursor-pointer"
                onClick={() => analytics.linkClick('github')}
              >
                <GithubMark size={14} />
                {t('footer.viewSource')}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </div>

            {/* BuyMeaCoffee Section */}
            <div className="bg-[oklch(0.5_0_0_/_0.03)] p-6 lg:p-8 rounded-3xl border border-border flex flex-col items-center gap-5 shadow-sm w-full lg:w-auto">
              <p
                className="text-xs lg:text-sm font-black text-zinc-500 uppercase tracking-widest leading-none"
                suppressHydrationWarning
              >
                {accountCount
                  ? t('footer.analyzedCount', { count: accountCount })
                  : t('footer.exportNeverLeavesBrowser')}
              </p>
              <a
                href="https://www.buymeacoffee.com/ignromanov"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 px-10 py-5 bg-primary text-primary-foreground rounded-2xl font-black text-sm lg:text-lg shadow-xl hover:scale-105 active:scale-95 transition-all w-full lg:w-auto justify-center cursor-pointer"
                onClick={() => analytics.linkClick('buy-me-coffee')}
              >
                <Coffee size={22} aria-hidden="true" />
                <span>{t('footer.buyACoffee')}</span>
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 lg:mt-10 flex flex-col lg:flex-row items-center justify-between gap-4 border-t border-border pt-6 text-sm text-zinc-400 font-bold">
          <div className="flex items-center gap-2">
            {t('footer.madeWithLove')}{' '}
            <Heart size={16} className="text-rose-500 fill-current animate-pulse" />{' '}
            {t('footer.forTheCommunity')}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-10">
            <span>{t('footer.copyright')}</span>
            <span className="hidden lg:block w-1.5 h-1.5 rounded-full bg-border" />
            <span className="text-primary opacity-90 uppercase tracking-tighter">
              {t('footer.license')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
