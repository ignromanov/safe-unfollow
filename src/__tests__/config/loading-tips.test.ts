import { describe, it, expect } from 'vitest';
import { LOADING_TIPS } from '@/config/loading-tips';

describe('LOADING_TIPS config', () => {
  it('has exactly 3 tips', () => {
    expect(LOADING_TIPS).toHaveLength(3);
  });

  it('tips are ordered by ascending delay', () => {
    for (let i = 1; i < LOADING_TIPS.length; i++) {
      expect(LOADING_TIPS[i]!.delayMs).toBeGreaterThan(LOADING_TIPS[i - 1]!.delayMs);
    }
  });

  it('each tip has required fields', () => {
    for (const tip of LOADING_TIPS) {
      expect(tip.id).toBeTruthy();
      expect(tip.delayMs).toBeGreaterThan(0);
      expect(tip.titleKey).toMatch(/^loadingTips\./);
      expect(tip.descKey).toMatch(/^loadingTips\./);
      expect(tip.url).toBeTruthy();
      expect(tip.icon).toBeDefined();
      expect(tip.color).toBeTruthy();
    }
  });

  it('all tip IDs are unique', () => {
    const ids = LOADING_TIPS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
