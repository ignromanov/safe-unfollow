import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INTENT_PAGES } from '@/config/intent-pages';
import { INTENT_DEMO } from '@/config/intent-demo-rows';

// Read from process.cwd(), never new URL(import.meta.url) — that throws ENOENT under this
// vitest config, and the failure reads like a missing fixture rather than a resolution bug.
//
// This is the same file the app loads and the build ships: src/lib/sample-data.ts:13 fetches
// /sample-data.json at runtime, and Vite copies public/ into dist/ verbatim.
//
// The file is itself generated, by scripts/generate-sample-snapshot.ts:208, whose randomness is
// seeded (:58-69) and therefore reproducible. So a red gate after a regeneration means the
// snapshot changed — not that this gate is flaky. Do not "fix" it by loosening an assertion.
const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/sample-data.json'), 'utf-8')
) as {
  accountCount: number;
  accounts: Array<{ username: string; badges: Record<string, number | true> }>;
};

describe('INTENT_DEMO', () => {
  // tsc owns this now: INTENT_DEMO is typed Record<IntentSlug, DemoSlice>, so a missing entry
  // is a compile error before any test runs. This case is a backstop for if that type ever
  // widens back to Record<string, DemoSlice> — it is not the live guard.
  it('should cover every page in the manifest', () => {
    for (const page of INTENT_PAGES) {
      expect(INTENT_DEMO[page.slug]).toBeDefined();
    }
  });

  for (const page of INTENT_PAGES) {
    describe(`/${page.slug}`, () => {
      const slice = () => INTENT_DEMO[page.slug];
      const matching = () => sample.accounts.filter(a => page.badge in a.badges);

      it('should state the count the sample actually holds', () => {
        expect(slice().matching).toBe(matching().length);
      });

      it('should state the sample total the file actually holds', () => {
        expect(slice().total).toBe(sample.accountCount);
      });

      it('should show usernames that are really in the sample with this badge', () => {
        const real = new Set(matching().map(a => a.username));
        for (const username of slice().usernames) {
          expect(real).toContain(username);
        }
      });

      it('should show eight rows', () => {
        expect(slice().usernames).toHaveLength(8);
      });

      it('should show eight distinct usernames', () => {
        expect(new Set(slice().usernames).size).toBe(8);
      });
    });
  }
});
