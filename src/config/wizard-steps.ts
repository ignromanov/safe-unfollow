export interface GuideStep {
  id: number;
  isWarning?: boolean;
  /**
   * Base path of this step's assets in public/wizard/ — a hyphen, not a slash.
   * Deliberately NOT derived from `id`: these files keep the names they had
   * when the guide was eight routes, so the 30-day asset cache
   * (vercel.json "/wizard/(.*)") keeps hitting. guide-steps.test.ts pins the
   * mapping.
   */
  visual: string;
}

/**
 * The seven instructions, numbered as the reader sees them.
 *
 * Old ids 2..8 became 1..7 when the entry screen stopped being step 1 and
 * became a block of the /upload document (GH#102). The old scheme had the URL
 * saying 6 next to a heading saying 5 — and `steps.1` never existed in any
 * locale, because step 1 was the entry screen and used `entry.*`.
 *
 * The `/wizard/step/N` routes are still live until PR 3 and still carry the
 * old numbering in their URLs; Wizard.tsx maps one onto the other rather than
 * renaming eight indexed pages twice.
 */
export const GUIDE_STEPS: GuideStep[] = [
  { id: 1, visual: '/wizard/step-2' },
  { id: 2, visual: '/wizard/step-3' },
  { id: 3, isWarning: true, visual: '/wizard/step-4' },
  { id: 4, visual: '/wizard/step-5' },
  { id: 5, isWarning: true, visual: '/wizard/step-6' },
  { id: 6, visual: '/wizard/step-7' },
  { id: 7, visual: '/wizard/step-8' },
];

/**
 * The DOM anchor a section carries, and the one `?step=N` scrolls to.
 *
 * Stated here rather than in either component: GuideStepSection writes the id
 * and GuideDialog queries and observes it, so the format is a contract
 * between two files and belongs with the list they both already import.
 */
export const guideStepAnchorId = (step: number) => `guide-step-${step}`;

/**
 * The eight live `/wizard/step/N` URLs, which outnumber the seven guide
 * sections by exactly the entry screen that became a document block.
 *
 * Stated once, here, because two consumers need it and neither owns it:
 * `Wizard.tsx` renders one dot per route and `useWizardNavigation.ts`
 * validates the route param against it. Both die together in PR 3.
 */
export const WIZARD_ROUTE_COUNT = GUIDE_STEPS.length + 1;

/**
 * Meta's export entry point. It used to be derived from step 1's
 * `externalLink`; step 1 is no longer a step, so the link stands on its own
 * rather than hiding inside a list it is not a member of. Typed `string`, not
 * `string | undefined` — the `.find()` that produced it could return nothing,
 * and every consumer had to pretend that was impossible.
 */
export const ACCOUNTS_CENTER_URL =
  'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings';
