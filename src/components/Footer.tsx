import { useState, useEffect } from 'react';
import { Heart, Coffee, EyeOff, Eye, Github, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { analytics, isTrackingOptedOut, optOutOfTracking, optIntoTracking } from '@/lib/analytics';
import { useStoreSSR } from '@/hooks/useStoreSSR';
import { Logo } from './Logo';
import { PrefixedLink } from './PrefixedLink';

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
                <Github size={14} aria-hidden="true" />
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
