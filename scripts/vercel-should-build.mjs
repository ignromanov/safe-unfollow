import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Paths whose change cannot reach `dist/`.
 *
 * `/^[^/]+\.md$/` is deliberately root-only. `docs/**` is NOT skippable: vercel.json's
 * buildCommand runs `jekyll build -d ../dist/docs`, so every file under docs/ is build
 * input. A nested `.md` must fall through to "build".
 */
export const SKIPPABLE = [/^\.github\//, /^[^/]+\.md$/];

/** true = skip the build. An empty list is never skippable: absence of a diff is not evidence. */
export function shouldSkipBuild(files) {
  if (files.length === 0) return false;
  return files.every(file => SKIPPABLE.some(pattern => pattern.test(file)));
}

function changedFiles() {
  const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (!base) return [];
  try {
    return execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    // Vercel clones shallowly, so `base` may not be reachable. Unknown means build.
    return [];
  }
}

/**
 * Run-as-entrypoint guard, compared exactly rather than by filename suffix.
 *
 * The two outcomes are not symmetric. If this guard fails to match when Vercel runs the
 * file, nothing calls `process.exit`, node exits 0 — and 0 tells Vercel to IGNORE the
 * build. Every deployment would silently stop building. A suffix comparison also matches
 * any same-named file in another directory, so it is exact equality here.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Vercel: exit 0 ignores the build, exit 1 continues it. Inverted from shell convention.
  process.exit(shouldSkipBuild(changedFiles()) ? 0 : 1);
}
