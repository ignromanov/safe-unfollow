import { useTranslation, Trans } from 'react-i18next';
import { ChevronRight, Play, Upload } from 'lucide-react';
import { PrefixedLink } from '@/components/PrefixedLink';
import { ResponsiveGif } from '@/components/ResponsiveGif';
import { GUIDE_STEPS } from '@/config/wizard-steps';

interface HowToStep {
  id: number;
  title: string;
  description: string;
  isWarning?: boolean;
  visual?: string;
}

// Step metadata (visuals and warnings are not translated).
//
// The seven middle steps ARE the guide's seven sections - same assets, same
// warning flag - so they are derived from GUIDE_STEPS rather than restated.
// Restating them is how this file came to mark two steps critical while
// wizard-steps.ts marked one: both name the same /wizard/step-N assets and
// neither imported the other, so the two could not disagree out loud.
//
// Only the ends are local: step 1 is the entry screen the guide stopped
// carrying (GH#102), and step 9 is the hand-off to /upload with no visual.
const STEP_META: Array<{ isWarning?: boolean; visual?: string }> = [
  { visual: '/wizard/step-1' },
  ...GUIDE_STEPS.map(({ isWarning, visual }) => ({ isWarning, visual })),
  {}, // Step 9: no visual, navigates to upload page
];

/** Step 9 is the hand-off to upload; the rest open their wizard step. */
function stepHref(stepIndex: number): string {
  return stepIndex === 8 ? '/upload' : `/wizard/step/${stepIndex + 1}`;
}

export function HowToSection() {
  const { t } = useTranslation('howto');

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
              <li key={step.id} className="relative group">
                <PrefixedLink
                  to={stepHref(idx)}
                  aria-label={t('openStepAria', { step: step.id, title: step.title })}
                  className="block ps-16 md:ps-24 cursor-pointer"
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
                        />
                      </div>
                    )}
                    {/* Step 9: upload call-to-action instead of a visual. Presentational
                        only — the whole card is already the link to the same place, and a
                        nested anchor would be invalid HTML. */}
                    {idx === 8 && (
                      <span className="mt-6 inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl group-hover:scale-105 transition-all text-sm md:text-base">
                        <Upload size={20} />
                        {t('uploadButton')}
                      </span>
                    )}
                    {idx !== 8 && (
                      <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('openStep')} <ChevronRight size={14} />
                      </div>
                    )}
                  </div>
                </PrefixedLink>
              </li>
            ))}
          </ol>

          <div className="mt-24 md:mt-40 p-10 md:p-16 rounded-4xl bg-primary text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl shadow-primary/30">
            <div className="text-center md:text-start space-y-4">
              <h4 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight leading-none">
                {t('cta.title')}
              </h4>
              <p className="opacity-90 font-bold text-base md:text-xl leading-relaxed">
                {t('cta.subtitle')}
              </p>
            </div>
            <PrefixedLink
              to="/wizard/step/1"
              className="cursor-pointer w-full md:w-auto px-10 py-5 bg-white text-primary font-black rounded-3xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg shadow-xl"
            >
              {t('cta.button')} <Play size={22} fill="currentColor" />
            </PrefixedLink>
          </div>
        </div>
      </section>
    </>
  );
}
