import { describe, it } from 'vitest';

/**
 * Gate for the suites in `src/__tests__/build/` that can only assert against a real `dist/`.
 *
 * Skipping such a suite locally is right — a developer should not have to run a full
 * `vite-react-ssg build` to run the unit tests. Skipping it in a CI job that was *supposed* to
 * build is a green that could not have gone red, and the job output does not distinguish
 * "N/N passed" from "0/N run" without reading the log line by line (GH#159).
 *
 * So the gate has three outcomes, not two, and the third is the point.
 *
 * ## Why `EXPECT_DIST` and not `process.env.CI`
 *
 * GH#159 proposes keying the loud case on `process.env.CI`. That would fail every one of these
 * suites on every pull request, because `code-quality.yml` also runs under `CI=true` and
 * deliberately does not build — it runs `test:coverage` only. Keying on `CI` therefore reddens a
 * workflow that is behaving as designed, which trains people to ignore the signal.
 *
 * `EXPECT_DIST` is set by the one workflow that promises a build (`.github/workflows/ci.yml`).
 * Its absence means "this job never claimed to build" and its presence means "a build was
 * promised" — so a missing `dist/` under it is a broken build step or a wrong predicate, and
 * both deserve a red test.
 *
 * ## What did NOT change
 *
 * `describe.skip(name, fn)` executes `fn` at collection time, exactly as `describe.runIf(false)`
 * did: the suite body still runs to register its tests, and only the tests are marked skipped.
 * Every suite here already walks `dist/` lazily inside `it()` for that reason, and this gate
 * keeps that requirement rather than relaxing it.
 */

export type DistGateMode = 'run' | 'fail' | 'skip';

/**
 * The whole decision, as a pure function, so it can be tested directly instead of inferred from
 * whether some other suite ran. A gate whose own behaviour is only observable through the thing
 * it gates is the defect this file exists to remove.
 */
export function distGateMode(ready: boolean, expectDist: string | undefined): DistGateMode {
  if (ready) return 'run';
  // An empty string is what an unset-but-declared workflow variable produces; treat it as unset
  // rather than as a promise, so a typo in the workflow cannot silently arm the loud path.
  if (expectDist !== undefined && expectDist !== '') return 'fail';
  return 'skip';
}

/**
 * Drop-in replacement for `describe.runIf(ready)(name, fn)`.
 *
 * @param name  suite name, as passed to `describe`
 * @param ready the suite's own predicate — usually `existsSync(dist) && existsSync(...)`.
 *              Each suite keeps its own, because what counts as "built" differs: some need
 *              `index.html`, the sitemap ones need `sitemap.xml`.
 * @param fn    the suite body
 */
export function describeDist(name: string, ready: boolean, fn: () => void): void {
  switch (distGateMode(ready, process.env.EXPECT_DIST)) {
    case 'run':
      describe(name, fn);
      return;
    case 'fail':
      describe(name, () => {
        // Registered through the same `describe`/`it` pair as a real assertion so it appears in
        // the run as a failure, not as a collection error with no suite name attached.
        it('requires a dist/, and EXPECT_DIST promised one', () => {
          throw new Error(
            `${name}: EXPECT_DIST is set, so this job promised a build, but this suite's dist/ ` +
              `predicate is false. Either the build step failed or the predicate is wrong. ` +
              `This is GH#159's loud case: without it the suite would have skipped in silence.`
          );
        });
      });
      return;
    case 'skip':
      describe.skip(name, fn);
      return;
  }
}
