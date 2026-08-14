import { Play, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { PrefixedLink } from './PrefixedLink';

export function FooterCTA() {
  const { t } = useTranslation('common');

  return (
    <section className="py-32 md:py-48 border-t border-border text-center flex flex-col items-center animate-in fade-in duration-1000">
      <Logo
        size={64}
        className="md:w-20 md:h-20 shadow-2xl mb-10 hover:rotate-12 transition-transform duration-500"
      />

      <h2 className="text-3xl md:text-6xl font-display font-extrabold tracking-tight mb-8 leading-[1.1] max-w-3xl px-4">
        {t('cta.title')}
      </h2>

      <p className="text-lg md:text-2xl text-zinc-500 dark:text-zinc-400 mb-12 md:mb-16 max-w-2xl mx-auto font-medium px-6 leading-relaxed">
        {t('cta.subtitle')}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full max-w-lg px-6">
        <PrefixedLink
          to="/wizard/step/1"
          className="w-full sm:w-auto px-12 py-5 rounded-2xl bg-primary text-primary-foreground font-black text-base md:text-xl shadow-2xl shadow-primary/40 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <Play size={22} fill="currentColor" />
          {t('cta.getStarted')}
        </PrefixedLink>
        <PrefixedLink
          to="/sample"
          className="w-full sm:w-auto px-10 py-5 rounded-2xl border-2 border-border bg-card font-black text-base md:text-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <Database size={22} />
          {t('cta.trySample')}
        </PrefixedLink>
      </div>

      <p className="mt-16 text-xs md:text-sm text-zinc-400 uppercase tracking-[0.2em] font-black opacity-60">
        {t('cta.tagline')}
      </p>
    </section>
  );
}
