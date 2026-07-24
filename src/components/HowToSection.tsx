import { useTranslation, Trans } from 'react-i18next';
import { ChevronRight, Play, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { ResponsiveGif } from '@/components/ResponsiveGif';

interface HowToStep {
  id: number;
  title: string;
  description: string;
  isWarning?: boolean;
  visual?: string;
}

// Step metadata (visuals and warnings are not translated)
// Step 9 has no visual - it's the final CTA to upload
const STEP_META: Array<{ isWarning?: boolean; visual?: string }> = [
  { visual: '/wizard/step-1' },
  { visual: '/wizard/step-2' },
  { visual: '/wizard/step-3' },
  { isWarning: true, visual: '/wizard/step-4' },
  { visual: '/wizard/step-5' },
  { isWarning: true, visual: '/wizard/step-6' },
  { visual: '/wizard/step-7' },
  { visual: '/wizard/step-8' },
  {}, // Step 9: no visual, navigates to upload page
];

interface HowToSectionProps {
  onStart?: (step?: number) => void;
}

export function HowToSection({ onStart }: HowToSectionProps) {
  const { t } = useTranslation('howto');
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  // Build steps from translations (using 'as any' for dynamic keys)
  const steps: HowToStep[] = Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    title: t(`steps.${i + 1}.title` as any),
    description: t(`steps.${i + 1}.description` as any),
    ...STEP_META[i],
  }));

  // Generate Schema.org HowTo structured data (safe: uses our own translation strings)
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('schema.name'),
    description: t('schema.description'),
    totalTime: 'PT5M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    supply: [
      { '@type': 'HowToSupply', name: t('schema.supplies.account') },
      { '@type': 'HowToSupply', name: t('schema.supplies.email') },
    ],
    tool: [{ '@type': 'HowToTool', name: t('schema.tool') }],
    step: steps.map(step => ({
      '@type': 'HowToStep',
      position: step.id,
      name: step.title,
      text: step.description,
      image: step.visual ? `${step.visual}-600w-poster.jpg` : undefined,
    })),
  };

  const handleStepClick = (stepIndex: number) => {
    // Step 9 (index 8) goes directly to upload page
    if (stepIndex === 8) {
      navigate(`${prefix}/upload`);
      return;
    }
    if (onStart) {
      onStart(stepIndex);
    } else {
      navigate(`${prefix}/wizard/step/${stepIndex + 1}`);
    }
  };

  const handleStartClick = () => {
    if (onStart) {
      onStart(0);
    } else {
      navigate(`${prefix}/wizard/step/1`);
    }
  };

  return (
    <>
      {/* Schema.org HowTo structured data - safe: uses our own translation strings */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToSchema),
        }}
      />
      <section id="how-it-works" className="py-24 md:py-40 border-t border-border">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-6xl font-display font-extrabold mb-8 text-center tracking-tight leading-[1.1]">
            <Trans
              i18nKey="title"
              ns="howto"
              components={{ gradient: <span className="text-gradient" /> }}
            >
              How to Check Your <span className="text-gradient">Instagram Unfollowers</span>
            </Trans>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-center mb-20 md:mb-32 max-w-2xl mx-auto text-base md:text-xl font-medium leading-relaxed">
            {t('subtitle')}
          </p>

          <ol className="space-y-16 md:space-y-24 relative before:absolute before:start-6 md:before:start-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
            {steps.map((step, idx) => (
              <li
                key={step.id}
                role="button"
                tabIndex={0}
                aria-label={t('openStepAria', { step: step.id, title: step.title })}
                className="relative ps-16 md:ps-24 group cursor-pointer"
                onClick={() => handleStepClick(idx)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStepClick(idx);
                  }
                }}
              >
                <div className="absolute start-0 top-0 w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-card border-2 border-primary flex items-center justify-center font-black text-lg md:text-2xl text-primary z-10 group-hover:scale-110 group-hover:shadow-2xl transition-all duration-300">
                  {step.id}
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl md:text-3xl font-display font-bold flex items-center flex-wrap gap-3 text-zinc-900 dark:text-white group-hover:text-primary transition-colors">
                    {step.title}
                    {step.isWarning && (
                      <span className="text-xs bg-amber-400 text-black px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">
                        {t('important')}
                      </span>
                    )}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium text-base md:text-lg">
                    {step.description}
                  </p>
                  {step.visual && (
                    <div className="rounded-3xl md:rounded-4xl overflow-hidden border border-border shadow-md max-w-xl mt-6 group-hover:border-primary/30 transition-all flex items-end">
                      <ResponsiveGif
                        basePath={step.visual}
                        alt={step.title}
                        className="w-full h-auto grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {/* Step 9: Upload button instead of visual */}
                  {idx === 8 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`${prefix}/upload`);
                      }}
                      className="cursor-pointer mt-6 inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base"
                    >
                      <Upload size={20} />
                      {t('uploadButton')}
                    </button>
                  )}
                  {idx !== 8 && (
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('openStep')} <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-24 md:mt-40 p-10 md:p-16 rounded-4xl bg-primary text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl shadow-primary/30">
            <div className="text-center md:text-start space-y-4">
              <h4 className="text-3xl md:text-5xl font-display font-black tracking-tight leading-none">
                {t('cta.title')}
              </h4>
              <p className="opacity-90 font-bold text-base md:text-xl leading-relaxed">
                {t('cta.subtitle')}
              </p>
            </div>
            <button
              onClick={handleStartClick}
              className="cursor-pointer w-full md:w-auto px-10 py-5 bg-white text-primary font-black rounded-3xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg shadow-xl"
            >
              {t('cta.button')} <Play size={22} fill="currentColor" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
