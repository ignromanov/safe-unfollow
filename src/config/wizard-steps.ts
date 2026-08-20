export interface WizardStep {
  id: number;
  externalLink?: string;
  isWarning?: boolean;
  visual?: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    externalLink:
      'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings',
    visual: '/wizard/step-1',
  },
  {
    id: 2,
    visual: '/wizard/step-2',
  },
  {
    id: 3,
    visual: '/wizard/step-3',
  },
  {
    id: 4,
    isWarning: true,
    visual: '/wizard/step-4',
  },
  {
    id: 5,
    visual: '/wizard/step-5',
  },
  {
    id: 6,
    isWarning: true,
    visual: '/wizard/step-6',
  },
  {
    id: 7,
    visual: '/wizard/step-7',
  },
  {
    id: 8,
    visual: '/wizard/step-8',
  },
];

// Step 1's external link, derived once here rather than recomputed in each
// consumer — Wizard.tsx's bottom bar and GuideEntry.tsx's in-flow CTA both
// point at it, and a copy in each risked drifting apart (see "no copied
// facts" in CLAUDE.md).
export const ACCOUNTS_CENTER_URL = WIZARD_STEPS.find(step => step.id === 1)?.externalLink;
