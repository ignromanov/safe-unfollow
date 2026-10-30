/**
 * What the build reads from the CI it runs in. Workers Builds injects `WORKERS_CI_*`
 * (developers.cloudflare.com/workers/ci-cd/builds/configuration/#environment-variables).
 */
type Env = Record<string, string | undefined>;

/** The production branch: the one whose builds `wrangler deploy` promotes. */
export const PRODUCTION_BRANCH = 'main';

/**
 * Short commit sha on Workers Builds, `package.json`'s version anywhere else.
 */
export function buildVersion(env: Env, pkgVersion: string): string {
  return env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) || pkgVersion;
}

/**
 * Drops the variables a preview build must not inherit.
 *
 * Vercel scoped `VITE_UMAMI_WEBSITE_ID` to Production; Workers Builds hands the same
 * build variables to every branch. A preview built with it writes its sessions into the
 * dataset the live numbers are read from — the exact failure `umami-loader.ts` documents.
 * Absence is the safe state, so it is removed for every Workers Builds branch but main.
 *
 * Mutates `env` in place: it is called on `process.env` before Vite reads it.
 */
export function scrubPreviewEnv(env: Env): void {
  const branch = env.WORKERS_CI_BRANCH;
  if (branch && branch !== PRODUCTION_BRANCH) {
    delete env.VITE_UMAMI_WEBSITE_ID;
  }
}
