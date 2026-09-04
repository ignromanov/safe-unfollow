import { useTranslation, Trans } from 'react-i18next';
import { ExternalLink, Play, Upload } from 'lucide-react';
import { PrefixedLink } from '@/components/PrefixedLink';
import { ResponsiveGif } from '@/components/ResponsiveGif';
import { GUIDE_STEPS } from '@/config/wizard-steps';
import { analytics } from '@/lib/analytics';

interface HowToStep {
  id: number;
  title: string;
  description: string;
  isWarning?: boolean;
  visual?: string;
  externalLink?: string;
}

// Step metadata (visuals, warnings and off-site destinations are not translated).
//
// The first eight steps ARE the guide's eight sections - same assets, same
// warning flag, same Accounts Center link on step 1 - so they are derived from
// GUIDE_STEPS rather than restated. Restating them is how this file came to
// mark two steps critical while wizard-steps.ts marked one: both name the same
// /wizard/step-N assets and neither imported the other, so the two could not
// disagree out loud.
//
// Only the tail is local: the last step is the hand-off to /upload, which is
// ours rather than Meta's and has no visual.
const STEP_META: Array<{ isWarning?: boolean; visual?: string; externalLink?: string }> = [
  ...GUIDE_STEPS.map(({ isWarning, visual, externalLink }) => ({
    isWarning,
    visual,
    externalLink,
  })),
  {}, // The hand-off: no visual, its own link to the upload page
];

const STEP_COUNT = STEP_META.length;

export function HowToSection() {
  // Two namespaces: the steps are `howto`'s, and step 1's button label is
  // `wizard.entry.cta` — the same string the guide dialog puts on the same
  // link, already native in ten locales. Re-translating "Open Accounts Center"
  // into a second key would be two canons for one button.
  const { t } = useTranslation(['howto', 'wizard']);

  // Build steps from translations (using 'as any' for dynamic keys)
  const steps: HowToStep[] = Array.from({ length: STEP_COUNT }, (_, i) => ({
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
            {/* The rows are content, not navigation. Every card used to be a
                link into the guide dialog on /upload — nine links to one
                screen, on the page that already shows the same eight posters
                and the same eight instructions. This section has to answer the
                question on its own, so the only two links left among the rows
                are the two actions a reader can actually take from here: ask
                Instagram for the file, and hand the file over. The section's
                closing CTA below is a third. */}
            {steps.map((step, idx) => (
              <li key={step.id} className="relative ps-16 md:ps-24">
                <div className="absolute start-0 top-0 w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-card border-2 border-primary flex items-center justify-center font-black text-lg md:text-2xl text-primary z-10">
                  {step.id}
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl md:text-3xl font-display font-bold flex items-center flex-wrap gap-3 text-zinc-900 dark:text-white">
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
                  {/* Step 1's own control, the same link the guide's section 1
                      carries. `linkClick` records no surface by design, so
                      `url_path` is the only separator there is: it tells this
                      one apart, because it is the only one that fires from "/".
                      It cannot tell apart the three on "/upload" — the dialog's
                      footer link, its step 1 section, and UploadGuideBlock. */}
                  {step.externalLink && (
                    <a
                      href={step.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => analytics.linkClick('meta_accounts')}
                      className="mt-6 inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base cursor-pointer"
                    >
                      {t('wizard:entry.cta')}
                      <ExternalLink size={20} aria-hidden="true" className="shrink-0" />
                    </a>
                  )}
                  {step.visual && (
                    <div className="rounded-3xl md:rounded-4xl overflow-hidden border border-border shadow-md max-w-xl mt-6 flex items-end">
                      <ResponsiveGif
                        basePath={step.visual}
                        alt={step.title}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                  {/* The last step has no visual, because it does not happen
                      inside Instagram. It is a real link now rather than a
                      styled span: the card around it used to be the anchor, so
                      a nested one would have been invalid HTML. */}
                  {idx === STEP_COUNT - 1 && (
                    <PrefixedLink
                      to="/upload"
                      className="mt-6 inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm md:text-base cursor-pointer"
                    >
                      <Upload size={20} aria-hidden="true" />
                      {t('uploadButton')}
                    </PrefixedLink>
                  )}
                </div>
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
              to="/upload?guide=1"
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
