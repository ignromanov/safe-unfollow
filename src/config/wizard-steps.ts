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
