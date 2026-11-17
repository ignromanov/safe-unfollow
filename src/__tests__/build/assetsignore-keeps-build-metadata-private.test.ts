import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { describeDist } from '../utils/dist-gate';

/**
 * `vite/ssg-meta-injector.ts` reads `dist/.vite/manifest.json` after the build, so the Vite
 * manifests must exist in `dist/`. `wrangler.jsonc` uploads all of `dist/` as public assets,
 * so `dist/.assetsignore` is what keeps them off the Worker. It comes from `public/`.
 */
const dist = resolve(__dirname, '../../../dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

describeDist('Worker asset upload', built, () => {
  it('ignores .vite/ and the ignore file itself', () => {
    const ignorePath = join(dist, '.assetsignore');
    expect(existsSync(ignorePath)).toBe(true);

    const lines = readFileSync(ignorePath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    expect(lines).toContain('.vite');
    expect(lines).toContain('.assetsignore');
  });
});
