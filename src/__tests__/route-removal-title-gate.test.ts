import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⛔ THIS FILE IS EXPECTED TO BE RED ON `feat/wizard-route-removal`. That is what
 * it is for. Read this comment before "fixing" it.
 *
 * The route removal (GH#102, PR 3) has two halves, and the plan says they must
 * land in the same commit:
 *
 *   1. the four `/wizard` 301s in `vercel.json`, which this branch ships; and
 *   2. rewritten `<title>`s for `/upload`, which this branch deliberately does
 *      NOT ship.
 *
 * Half 2 is blocked on a Google Search Console export the operator has not
 * delivered, by the growth advisor's explicit decision, and deferring it is the
 * right call: the 80 indexed `/wizard` URLs rank for "how to download your
 * Instagram data as JSON", a 301 re-evaluates the TARGET against those queries,
 * and `/upload`'s title currently says nothing about downloading data. Nobody
 * can size that cost without the export, and "we cannot measure it" is an
 * argument for waiting rather than for guessing.
 *
 * What this file fixes is the ENFORCEMENT, not the decision. Until now the only
 * thing holding the branch was a note in a PR description, while `code:check`,
 * the full suite and `perf:budget` all said yes — every mechanical gate agreed
 * with merging. This project's own stated remedy for exactly that is "a fact
 * that a test computes cannot silently rot" (`architecture-facts.test.ts`), so
 * here it is as a red check instead of a label somebody has to remember.
 *
 * It encodes NO opinion about the copy. It cannot: the only thing it knows is
 * the string that is there today. It goes green the moment ANY different title
 * is written, whatever it says — good, bad, long, short. The tripwire value
 * below is a "has this been touched" marker, not a specification, and nothing
 * here should ever be read as review of what replaces it.
 *
 * To retire this gate: when the titles land, this test goes green on its own.
 * Delete it once PR 3 is merged — it has no meaning on any later branch.
 */

const ROOT = resolve(__dirname, '../..');

/**
 * `src/locales/en/meta.json` → `routes["/upload"].title` as it stands before the
 * rewrite, byte for byte. Identical on `origin/main` and at this branch's base
 * `103173d`, verified 2026-08-28 — so it is genuinely the pre-PR value and not
 * something this branch already moved.
 */
const PRE_REDIRECT_UPLOAD_TITLE = 'Upload Instagram ZIP: Free Unfollower Analysis';

function uploadTitle(): string {
  const meta = JSON.parse(readFileSync(resolve(ROOT, 'src/locales/en/meta.json'), 'utf8')) as {
    routes: Record<string, { title: string }>;
  };

  const title = meta.routes['/upload']?.title;
  if (typeof title !== 'string') {
    throw new Error('en/meta.json no longer declares routes["/upload"].title');
  }
  return title;
}

/** How many `/wizard` redirect rules `vercel.json` ships. Zero before this branch. */
function wizardRedirectCount(): number {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    redirects: Array<{ source: string }>;
  };

  return config.redirects.filter(rule => /\/wizard(\/|$)/.test(rule.source)).length;
}

describe('the /wizard route removal ships with its title rewrite', () => {
  it('does not 301 eighty indexed URLs into a page still carrying its pre-redirect title', () => {
    const shipsRedirects = wizardRedirectCount() > 0;
    const titleIsUntouched = uploadTitle() === PRE_REDIRECT_UPLOAD_TITLE;

    // Deliberately a conjunction rather than two assertions: neither half is a
    // defect on its own. The redirects alone are correct work, and the old title
    // alone is the state of `main`. Only shipping the first WITHOUT the second
    // is the thing the plan forbids, so only that combination goes red.
    expect(
      shipsRedirects && titleIsUntouched,
      'vercel.json ships the /wizard 301s while src/locales/en/meta.json still ' +
        `carries routes["/upload"].title = ${JSON.stringify(PRE_REDIRECT_UPLOAD_TITLE)}. ` +
        'The plan requires both halves in the same commit. This gate has no opinion ' +
        'about what the new title should say — write any different one and it goes green.'
    ).toBe(false);
  });
});
