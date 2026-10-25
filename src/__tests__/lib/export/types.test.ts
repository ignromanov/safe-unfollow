import { describe, expect, it } from 'vitest';

import { assertNever } from '@/lib/export/types';

describe('assertNever', () => {
  it('assertNever rejects at compile time and throws at runtime', () => {
    // @ts-expect-error — a string is not never
    expect(() => assertNever('csv')).toThrow('Unhandled export format: csv');
  });
});
