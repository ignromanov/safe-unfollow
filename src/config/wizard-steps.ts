/**
 * A stable name for the instruction a step carries, independent of where it
 * sits in the list.
 *
 * The numbering has moved three times in this stream (eight routes, then
 * seven sections, then eight again). Anything that has to point at a
 * particular instruction — `guideStepForError` is the only such consumer
 * today — names it instead of copying its current position, so a renumbering
 * carries the reference with it rather than leaving it behind pointing at
 * whatever moved into that slot.
 */
export type GuideStepKey =
  | 'accountsCenter'
  | 'chooseProfile'
  | 'exportToDevice'
  | 'selectFollowers'
  | 'dateRange'
  | 'formatJson'
  | 'reviewAndStart'
  | 'waitForEmail';

export interface GuideStep {
  id: number;
  key: GuideStepKey;
  isWarning?: boolean;
  /**
   * Base path of this step's assets in public/wizard/ — a hyphen, not a slash.
   * The hyphen is what keeps these assets out of the four "/wizard" redirect
   * rules: two match "/wizard" exactly and two require a slash after it, so a
   * path beginning "/wizard/step-" matches none of them. guide-steps.test.ts
   * pins the mapping.
   */
  visual: string;
  /**
   * An off-site destination this step asks the reader to open, or absent when
   * the step is something they do on a screen they are already looking at.
   *
   * Exactly one step has one, and that is not an accident waiting to be
   * generalised: the guide walks Meta's export flow, and only its first
   * instruction is "go there". A reader on step 4 is inside the dialog this
   * field would link to.
   */
  externalLink?: string;
}

/**
 * Meta's export entry point — the screen step 1 tells the reader to open.
 *
 * Declared before `GUIDE_STEPS` because step 1 carries it, and exported
 * because the guide's closing card links to the same place without being a
 * step. Typed `string`, not `string | undefined`: consumers that need the URL
 * read this constant rather than searching the array for the step that has it.
 */
export const ACCOUNTS_CENTER_URL =
  'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings';

/**
 * The eight instructions, numbered as the reader sees them.
 *
 * The numbering is now the same one on every surface that counts these steps:
 * the landing page's HowTo section, its schema.org `HowTo`, the `/upload`
 * accordion, the guide dialog, and `docs/instagram-export.md`. It had not been
 * — the guide started at "Choose your Instagram profile" while every other
 * list started at "Open Meta Accounts Center", so a reader who clicked the
 * card numbered 6 on the landing page arrived at a dialog calling the same
 * instruction "Step 5 of 7". `HowToSection` had to subtract one to bridge
 * that, and `HowToSection.test.tsx` pinned the subtraction.
 *
 * Restoring the first step also restores the identity `id N -> /wizard/step-N`
 * that the ids briefly lost: these files have kept their names since the guide
 * was eight routes (GH#102), so the 30-day asset cache
 * (vercel.json "/wizard/step-(.*)") keeps hitting and the mapping needs no
 * table to explain it.
 *
 * Exactly one step is a warning, and it is step 4, not the format step. Until
 * #152 an HTML export could not be read at all, so format was the one choice
 * that made the whole export useless; now it parses, and the step that still
 * ruins the export is the one where clearing the wrong checkboxes leaves no
 * follower data to read. Two amber cards out of eight were a colour rather
 * than a hierarchy, so the count stays at one.
 */
export const GUIDE_STEPS: GuideStep[] = [
  { id: 1, key: 'accountsCenter', visual: '/wizard/step-1', externalLink: ACCOUNTS_CENTER_URL },
  { id: 2, key: 'chooseProfile', visual: '/wizard/step-2' },
  { id: 3, key: 'exportToDevice', visual: '/wizard/step-3' },
  { id: 4, key: 'selectFollowers', isWarning: true, visual: '/wizard/step-4' },
  { id: 5, key: 'dateRange', visual: '/wizard/step-5' },
  { id: 6, key: 'formatJson', visual: '/wizard/step-6' },
  { id: 7, key: 'reviewAndStart', visual: '/wizard/step-7' },
  { id: 8, key: 'waitForEmail', visual: '/wizard/step-8' },
];

/**
 * The section number carrying a named instruction.
 *
 * Throws rather than falling back, and that is the point: a fallback would
 * send a reader whose upload failed to an instruction that does not answer
 * them, silently. A key that stops existing is a build-time type error at
 * every call site and a loud failure at the one place a key could be computed.
 */
export function guideStepId(key: GuideStepKey): number {
  const step = GUIDE_STEPS.find(s => s.key === key);
  if (!step) throw new Error(`No guide step is keyed "${key}"`);
  return step.id;
}

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
 * Poster assets are not one aspect ratio: steps 1 and 2 are 600x360 (5:3),
 * steps 3-8 are 600x450 (4:3). Real width/height attributes let the browser
 * reserve each row's box from its own intrinsic size before the image
 * loads — forcing every row into 4:3 would crop or letterbox the two.
 *
 * The override list is keyed by id and the ids moved, so it moved with them.
 * Measured from the files themselves, not carried over: `step-1-600w-poster.jpg`
 * is 600x360 like `step-2`, which is why there are two entries here and not one.
 *
 * Shared by StepAccordion (the /upload disclosure) and GuideStepSection (the
 * dialog) — both render the same eight posters and both need the same sizes.
 */
const DEFAULT_POSTER_SIZE: PosterSize = { width: 600, height: 450 };
const POSTER_SIZE_OVERRIDES: Partial<Record<number, PosterSize>> = {
  1: { width: 600, height: 360 },
  2: { width: 600, height: 360 },
};

export const guideStepPosterSize = (step: number): PosterSize =>
  POSTER_SIZE_OVERRIDES[step] ?? DEFAULT_POSTER_SIZE;
