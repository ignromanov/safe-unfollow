import { describe, expect, it } from 'vitest';

import { LOADING_TIPS } from '@/config/loading-tips';

describe('LOADING_TIPS', () => {
  it('carries privacy tips only — the paid card moved to the upload body', () => {
    expect(LOADING_TIPS).toHaveLength(2);
    expect(LOADING_TIPS.map(tip => tip.id)).toEqual(['local-processing', 'revoke-access']);
  });

  it('carries no affiliate link, so the parsing window sells nothing', () => {
    for (const tip of LOADING_TIPS) {
      expect(tip).not.toHaveProperty('url');
    }
  });

  it('keeps delays ascending, which is what makes reveal indices match analytics', () => {
    const delays = LOADING_TIPS.map(tip => tip.delayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  it('reveals every tip inside the window a typical parse survives', () => {
    // Choreography, not gating. Most exports finish parsing in 1-3s and the 42%
    // that fail on format fail sooner, so a tip past this bound is unseen.
    const REVEAL_BUDGET_MS = 1200;

    for (const tip of LOADING_TIPS) {
      expect(tip.delayMs, `${tip.id} is revealed too late to be seen`).toBeLessThanOrEqual(
        REVEAL_BUDGET_MS
      );
    }
  });
});
