import {
  Shield,
  Ban,
  Infinity as InfinityIcon,
  Code,
  Database,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { analytics } from '@/lib/analytics';

interface HeroProps {
  onStartGuide: () => void;
  onLoadSample: () => void;
  onUploadDirect: () => void;
  hasData?: boolean;
  onContinue?: () => void;
}

export function Hero({
  onStartGuide,
  onLoadSample,
  onUploadDirect,
  hasData,
  onContinue,
}: HeroProps) {
  const { t } = useTranslation('hero');

  return (
    <section className="py-12 md:py-32 text-center max-w-5xl mx-auto flex flex-col items-center animate-in fade-in duration-700">
      {/* Version Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs mb-8 md:mb-12 border border-primary/20 backdrop-blur-md shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        {t('version')}
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight mb-8 leading-[1.0] text-balance px-4 text-zinc-900 dark:text-white">
        {t('headline.prefix')} <span className="text-gradient">{t('headline.highlight')}</span>{' '}
        <br className="hidden md:block" />
        {t('headline.suffix')}
      </h1>

      {/* Subheadline */}
      <p className="text-base md:text-xl lg:text-2xl text-zinc-500 dark:text-zinc-400 mb-10 md:mb-14 max-w-2xl mx-auto font-medium px-6 leading-relaxed">
        {t('subheadline')}
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col items-center gap-6 mb-20 md:mb-32 w-full max-w-3xl px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
          {hasData ? (
            <button
              onClick={() => {
                onContinue?.();
                analytics.heroCTAContinue?.();
              }}
              className="cursor-pointer w-full sm:w-auto px-10 md:px-12 py-4 md:py-5 rounded-3xl bg-primary text-white font-bold text-base md:text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
              {t('buttons.viewResults')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              onClick={() => {
                onStartGuide();
                analytics.heroCTAGuide?.();
              }}
              className="cursor-pointer w-full sm:w-auto px-10 md:px-12 py-4 md:py-5 rounded-3xl bg-primary text-white font-bold text-base md:text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
              {t('buttons.getGuide')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* Secondary CTA */}
          <button
            onClick={() => {
              onLoadSample();
              analytics.heroCTASample?.();
            }}
            className="cursor-pointer w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 rounded-3xl border border-border bg-card font-bold text-base md:text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
          >
            <Database size={20} className="text-accent" />
            {t('buttons.trySample')}
          </button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-zinc-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-500" /> {t('trust.free')}
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-500" /> {t('trust.noPassword')}
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-500" /> {t('trust.privacy')}
          </div>
        </div>

        {/* Tertiary Link */}
        {!hasData && (
          <button
            onClick={() => {
              onUploadDirect();
              analytics.heroCTAUploadDirect?.();
            }}
            className="cursor-pointer text-zinc-400 hover:text-primary font-bold text-xs uppercase tracking-widest transition-all underline underline-offset-4 decoration-zinc-200"
          >
            {t('buttons.haveFile')}
          </button>
        )}
      </div>

      {/* Feature Cards */}
      <h2 className="sr-only">{t('features.heading', 'Key Features')}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 w-full max-w-6xl px-4">
        <div className="p-6 md:p-10 rounded-4xl border border-border bg-card text-start shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-default group flex flex-col items-start">
          <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform">
            <Shield className="text-emerald-500" size={24} />
          </div>
          <div className="font-bold text-sm md:text-lg mb-2 leading-tight">
            {t('features.local.title')}
          </div>
          <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">
            {t('features.local.description')}
          </div>
        </div>

        <div className="p-6 md:p-10 rounded-4xl border border-border bg-card text-start shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-default group flex flex-col items-start">
          <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform">
            <Ban className="text-rose-500" size={24} />
          </div>
          <div className="font-bold text-sm md:text-lg mb-2 leading-tight">
            {t('features.noLogin.title')}
          </div>
          <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">
            {t('features.noLogin.description')}
          </div>
        </div>

        <div className="p-6 md:p-10 rounded-4xl border border-border bg-card text-start shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-default group flex flex-col items-start">
          <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform">
            <InfinityIcon className="text-indigo-500" size={24} />
          </div>
          <div className="font-bold text-sm md:text-lg mb-2 leading-tight">
            {t('features.scale.title')}
          </div>
          <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">
            {t('features.scale.description')}
          </div>
        </div>

        <div className="p-6 md:p-10 rounded-4xl border border-border bg-card text-start shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-default group flex flex-col items-start">
          <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform">
            <Code className="text-amber-500" size={24} />
          </div>
          <div className="font-bold text-sm md:text-lg mb-2 leading-tight">
            {t('features.openSource.title')}
          </div>
          <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">
            {t('features.openSource.description')}
          </div>
        </div>
      </div>
    </section>
  );
}
