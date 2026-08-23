import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * velum-cdpo's condition 2 (`.claude/plans/2026-08-19-feedback-channel/07-trigger.md`):
 * Tally's `embed.js` must load only when a visitor actually opens the feedback form
 * (see `src/lib/feedback/tally.ts`), never merely because a page carrying the trigger was
 * requested — including the ~144 prerendered locale pages, where nobody has clicked
 * anything yet. `FeedbackPrompt` only mounts on `/results`, which is client-only (see
 * `vite.config.ts`), so today this test proves the absence has no source to begin with;
 * it exists to catch a future change that adds a `<head>` snippet or an eager import,
 * which would defeat `openFeedbackForm`'s lazy-injection design silently.
 *
 * `describe.runIf(built)` like the other prerender suites: this only runs against
 * `dist/`, which only `ci.yml` produces before the tests. A dist-less local run skips it
 * rather than failing, and that skip is not a pass.
 */
const dist = resolve(__dirname, '../../../dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

describe.runIf(built)('no Tally reference in prerendered HTML', () => {
  it('scans some prerendered pages', () => {
    // Guards the guard: an empty glob would report success for the wrong reason.
    expect(htmlFiles(dist).length).toBeGreaterThan(10);
  });

  it('ships no tally.so reference on any prerendered page', () => {
    const offenders = htmlFiles(dist)
      .map(file => ({ page: relative(dist, file), html: readFileSync(file, 'utf-8') }))
      .filter(({ html }) => html.includes('tally.so'));

    expect(
      offenders.map(o => o.page),
      'A prerendered page loads Tally before the reader has clicked the feedback ' +
        'trigger. openFeedbackForm() must stay the only path that injects embed.js.'
    ).toEqual([]);
  });
});
