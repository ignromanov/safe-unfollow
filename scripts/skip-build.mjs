import { pathToFileURL } from 'node:url';

/**
 * Branches whose builds Workers Builds should skip: dependabot's. 43% of deployments in the
 * 2026-09-14 audit were dependabot dev-dependency bumps that cannot change `dist/`; CI
 * (ci.yml) still builds and tests every one of them, so a preview adds nothing but build
 * minutes. Vercel expressed this as `git.deploymentEnabled`; Workers Builds has no branch
 * pattern setting, so the build and preview commands ask this script first:
 *
 *   build:   node scripts/skip-build.mjs || npm run build:all
 *   preview: node scripts/skip-build.mjs || npx wrangler preview
 *
 * Path-based skipping (`.github/`, root *.md) is the dashboard's Build watch paths, which
 * see the pushed diff; this script cannot, because the build clone carries no previous sha.
 */
export const SKIPPED_BRANCHES = [/^dependabot\//];

/** true = skip. No branch (a local run) is never skipped. */
export function shouldSkipBuild(branch) {
  if (!branch) return false;
  return SKIPPED_BRANCHES.some(pattern => pattern.test(branch));
}

/**
 * Run-as-entrypoint guard, compared exactly. Exit 0 means SKIP (the `||` then runs
 * nothing), exit 1 means build — inverted from shell convention, so that a script which
 * fails to run at all (exit 1 from node) falls through to building.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const branch = process.env.WORKERS_CI_BRANCH;
  const skip = shouldSkipBuild(branch);
  console.log(skip ? `skip-build: skipping branch ${branch}` : 'skip-build: building');
  process.exit(skip ? 0 : 1);
}
