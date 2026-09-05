import type { IntentSlug } from './intent-pages';

/**
 * The demo rows each intent page shows, taken from public/sample-data.json.
 *
 * A slice rather than the file: the file is 148 KB and Vite would inline all of it to render
 * eight rows. A test asserts this slice still matches the file, so regenerating the sample fails
 * the build rather than silently putting a wrong count on a public page.
 */
export interface DemoSlice {
  /** Eight real usernames from the sample that carry this page's badge. */
  usernames: readonly string[];
  /** How many of the sample's accounts carry it. */
  matching: number;
  /** How many accounts the sample holds in total. */
  total: number;
}

export const INTENT_DEMO: Record<IntentSlug, DemoSlice> = {
  'who-doesnt-follow-me-back': {
    usernames: [
      'mattcoffee_co',
      'emilyski.ig',
      'build.jason23',
      'music.scott',
      'nature.sarah2',
      'gaming.chris23',
      'run.maria21',
      'matt_explore',
    ],
    matching: 150,
    total: 1180,
  },
  'instagram-pending-follow-requests': {
    usernames: [
      'briandraw_life',
      'markfood',
      'explore.natalie',
      'ski.mike23',
      'write.daniel99',
      'bake.ryan7',
      'kevin_music13',
      'emily_dream7',
    ],
    matching: 30,
    total: 1180,
  },
  'instagram-mutual-followers': {
    usernames: [
      'julia_fitness',
      'justemmaa99',
      'justmegann13',
      'justmariaa3',
      'justscottt7',
      'justandreww2',
      'james.bikes3',
      'hannah.foods1',
    ],
    matching: 225,
    total: 1180,
  },
};
