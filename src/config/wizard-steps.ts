export interface GuideStep {
  id: number;
  isWarning?: boolean;
  /**
   * Base path of this step's assets in public/wizard/ — a hyphen, not a slash.
   * Deliberately NOT derived from `id`: these files keep the names they had
   * when the guide was eight routes, so the 30-day asset cache
   * (vercel.json "/wizard/step-(.*)") keeps hitting. The hyphen is what keeps
   * these assets out of the four "/wizard" redirect rules, which all match a
   * slash. guide-steps.test.ts pins the mapping.
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
 * The old numbering survived in the `/wizard/step/N` URLs until PR 3 removed
 * those routes; the ids below are now the only numbering there is, and they
 * are what `?step=N` names.
 *
 * Exactly one step is a warning, and it is step 3, not the format step. Until
 * #152 an HTML export could not be read at all, so format was the one choice
 * that made the whole export useless; now it parses, and the step that still
 * ruins the export is the one where clearing the wrong checkboxes leaves no
 * follower data to read. Two amber cards out of seven were a colour rather
 * than a hierarchy, so the count stays at one.
 */
export const GUIDE_STEPS: GuideStep[] = [
  { id: 1, visual: '/wizard/step-2' },
  { id: 2, visual: '/wizard/step-3' },
  { id: 3, isWarning: true, visual: '/wizard/step-4' },
  { id: 4, visual: '/wizard/step-5' },
  { id: 5, visual: '/wizard/step-6' },
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

interface PosterSize {
  width: number;
  height: number;
}

/**
 * Poster assets are not one aspect ratio: section 1's is 600x360 (5:3),
 * sections 2-7 are 600x450 (4:3). Real width/height attributes let the browser
 * reserve each row's box from its own intrinsic size before the image
 * loads — forcing every row into 4:3 would crop or letterbox step 1.
 *
 * Shared by StepAccordion (the /upload disclosure) and GuideStepSection (the
 * dialog) — both render the same seven posters and both need the same sizes.
 */
const DEFAULT_POSTER_SIZE: PosterSize = { width: 600, height: 450 };
const POSTER_SIZE_OVERRIDES: Partial<Record<number, PosterSize>> = {
  1: { width: 600, height: 360 },
};

export const guideStepPosterSize = (step: number): PosterSize =>
  POSTER_SIZE_OVERRIDES[step] ?? DEFAULT_POSTER_SIZE;

/**
 * Meta's export entry point. It used to be derived from step 1's
 * `externalLink`; step 1 is no longer a step, so the link stands on its own
 * rather than hiding inside a list it is not a member of. Typed `string`, not
 * `string | undefined` — the `.find()` that produced it could return nothing,
 * and every consumer had to pretend that was impossible.
 */
export const ACCOUNTS_CENTER_URL =
  'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings';
