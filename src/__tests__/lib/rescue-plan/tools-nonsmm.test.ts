import { describe, it, expect } from 'vitest';
import { getToolsForSegment } from '@/lib/rescue-plan/tools';
import type { UserSegment } from '@/lib/rescue-plan/types';

function makeSegment(severity: UserSegment['severity'], size: UserSegment['size']): UserSegment {
  const percentMap = { critical: 15, warning: 5, growth: 1 };
  const totalMap = { influencer: 15000, power: 5000, regular: 1000, casual: 200 };
  return {
    severity,
    size,
    unfollowedPercent: percentMap[severity],
    totalAccounts: totalMap[size],
  };
}

describe('TOOL_MATRIX non-SMM slot replacements', () => {
  it('growth_casual slot 3 should be grammarly', () => {
    const tools = getToolsForSegment(makeSegment('growth', 'casual'));
    expect(tools[2]?.id).toBe('grammarly');
  });

  it('growth_regular slot 3 should be grammarly', () => {
    const tools = getToolsForSegment(makeSegment('growth', 'regular'));
    expect(tools[2]?.id).toBe('grammarly');
  });

  it('warning_casual slot 3 should be grammarly', () => {
    const tools = getToolsForSegment(makeSegment('warning', 'casual'));
    expect(tools[2]?.id).toBe('grammarly');
  });

  it('warning_regular slot 3 should be nordvpn', () => {
    const tools = getToolsForSegment(makeSegment('warning', 'regular'));
    expect(tools[2]?.id).toBe('nordvpn');
  });

  it('unchanged segments still have SMM tools', () => {
    const tools = getToolsForSegment(makeSegment('critical', 'influencer'));
    expect(tools.map(t => t.id)).toEqual(['predis', 'metricool', 'socialpilot']);
  });

  it('non-SMM tools have correct categories', () => {
    const tools = getToolsForSegment(makeSegment('growth', 'casual'));
    const grammarly = tools.find(t => t.id === 'grammarly');
    expect(grammarly?.category).toBe('productivity');
  });
});
