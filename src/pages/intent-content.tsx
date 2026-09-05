import type { ReactNode } from 'react';
import type { IntentPageConfig } from '@/config/intent-pages';

/**
 * The four things every intent page answers, from the spec at
 * .claude/plans/2026-09-05-filter-and-intent-pages/03-landing-template.md: what the badge means,
 * how the export represents it, what the number does and does not tell the reader, and what they
 * can do next.
 *
 * They are four required fields rather than free-form prose so a page cannot quietly ship with
 * three of them. Near-duplicate pages differing by a swapped noun are the thin-content failure
 * this whole page class is judged on; distinct bodies are the defence, and the structure is what
 * makes it obvious when one is missing.
 */
export interface IntentContent {
  /** One paragraph under the h1. The answer, before any explanation of it. */
  intro: ReactNode;
  /** Ordered h2 sections. Four or more — see the type doc above. */
  sections: ReadonlyArray<{ heading: string; body: ReactNode }>;
  /** The single call to action's visible text. */
  ctaLabel: string;
}

/**
 * Where the CTA goes. `filter` is applied on arrival by useFilterFromUrl(); `from` is the only
 * value that will ever reach the session summary's `arrived_from`. Both survive the parse —
 * UploadPage carries them to /results.
 *
 * One function so the URL is built in one place: the analytics call in the click handler reads
 * this too, rather than assembling a second copy that can drift from the anchor's own href.
 */
export function ctaHref(page: IntentPageConfig): string {
  return `/upload?filter=${page.badge}&from=${page.slug}`;
}

export const INTENT_CONTENT: Record<string, IntentContent> = {
  'who-doesnt-follow-me-back': {
    intro: (
      <>
        Your Instagram data export contains both lists: everyone you follow, and everyone who
        follows you. The accounts in the first list and not the second are the ones that do not
        follow you back. This page shows you how to read that answer out of your own export, without
        logging in to anything.
      </>
    ),
    sections: [
      {
        heading: 'What "not following back" actually counts',
        body: (
          <>
            <p>
              An account is counted when you follow it and it does not follow you — with one
              deliberate exclusion. Follow requests you have sent that were never accepted are{' '}
              <strong>not</strong> in this list. An account you asked to follow and that never
              answered has not declined to follow you back; it has not answered you at all. Those
              live in their own list, and mixing the two is the most common way this number comes
              out wrong.
            </p>
            <p>
              Private accounts you requested and were rejected by are excluded for the same reason.
            </p>
            <p>
              Both exclusions depend on those lists being present and readable in your archive.
              Instagram does not always include them, and when one is missing nothing is subtracted
              — the count is then a little high rather than wrong in kind.
            </p>
          </>
        ),
      },
      {
        heading: 'Where it comes from in the export',
        body: (
          <>
            <p>
              When you request your data from Instagram, the archive contains a{' '}
              <code>connections/followers_and_following</code> folder. Two files in it carry the
              whole answer: the list of accounts you follow, and the list of accounts following you.
              Everything on this page is one comparison between those two lists.
            </p>
            <p>
              Choose <strong>All time</strong> rather than a date range when Instagram offers you
              the choice — a date-limited export silently truncates both lists, and the missing
              accounts look exactly like people who left.
            </p>
          </>
        ),
      },
      {
        heading: 'What the number does not tell you',
        body: (
          <>
            <p>
              It is a snapshot of the moment Meta assembled your archive, not a live feed. Nothing
              here watches your account, and nothing can: that would need your login, which is the
              thing this tool exists to avoid.
            </p>
            <p>
              It also does not mean these accounts unfollowed you. Most of them never followed you
              in the first place. And whether someone followed you before and does not now is not a
              question one archive can answer: an archive is a single snapshot, and a snapshot has
              no memory of an earlier one. Telling those apart would take two archives, requested at
              different times and compared against each other, which this tool does not do.
            </p>
          </>
        ),
      },
      {
        heading: 'What you can do with it',
        body: (
          <>
            <p>
              Read it, sort it, and decide. This tool does not follow or unfollow anything on your
              behalf — it never connects to Instagram, so it cannot. Every action stays yours, in
              the app, where Instagram expects it.
            </p>
            <p>
              The list is yours to keep too: the analysis runs entirely inside this browser tab and
              your archive never leaves your device.
            </p>
          </>
        ),
      },
    ],
    ctaLabel: 'See who does not follow you back',
  },
};
