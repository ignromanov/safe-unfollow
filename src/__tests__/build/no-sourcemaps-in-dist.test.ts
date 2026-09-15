import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { describeDist } from '../utils/dist-gate';

/**
 * The artefact half of the no-sourcemaps decision. `vite/build-config.ts` declaring
 * `sourcemap: false` is asserted directly in `src/__tests__/vite/build-config.test.ts`;
 * this suite asks the different question of whether a real build honoured it, because a
 * plugin or an SSG pass can re-enable emission without touching that field.
 */
const dist = resolve(__dirname, '../../../dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

describeDist('built output', built, () => {
  it('contains no .map files under assets/', () => {
    const assets = join(dist, 'assets');
    const maps = existsSync(assets)
      ? readdirSync(assets).filter(name => name.endsWith('.map'))
      : [];

    expect(maps).toEqual([]);
  });
});
