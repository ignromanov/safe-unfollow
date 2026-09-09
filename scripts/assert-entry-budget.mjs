/**
 * Fails when the entry bundle grows past its budget. Without this, one new static import
 * at the root of the module graph silently puts back what this task removed, and nothing
 * in the test suite notices.
 *
 * Usage: see `.github/workflows/ci.yml`'s build step for the environment this needs, and the
 * error messages below for what happens without it.
 *
 * ## Why the environment is mandatory
 *
 * Vite substitutes `import.meta.env.VITE_*` at build time. Unset, each folds to a constant,
 * the guard reading it folds too, and Rollup eliminates the code path behind it. Two whole
 * revenue surfaces leave the bundle that way, and both were measured absent, not assumed:
 *
 *   VITE_DODO_CHECKOUT_URL  gates the paid export path (`src/lib/export/unlock.ts`)
 *   VITE_ADSENSE_CLIENT     gates every ad, because `eligible` in `AdSlot.tsx` starts with
 *                           `Boolean(client)` and `AdSlot` is the sole injector of
 *                           adsbygoogle.js -- with the client unset the whole branch folds
 *                           and even the string `adsbygoogle.js` is gone
 *
 * Measured on 2026-09-09, both artefacts of commit 2f81de0:
 *
 *   CI     (unset)  app-D3zGKkYn.js  424462 bytes  -- green against a 428700 budget
 *   Vercel (set)    app-DciMtuoj.js  428939 bytes  -- 239 bytes ABOVE that same budget
 *
 * Different content hashes from one source: the file Vercel serves had passed through no gate
 * in this repository. `redirect_url`, `adsbygoogle`, `adsbygoogle.js` and `ca-pub` each occur
 * once in the shipped chunk and zero times in a build made here, where no `.env` exists --
 * with `safeunfollow` present in both as the control proving the search read both files.
 *
 * ## The control below, and why it reads the environment rather than a literal
 *
 * A gate that greps for a string copied out of `unlock.ts` goes quietly blind the day that
 * string is renamed. So the marker is each *configured value itself*: we set the variable, so
 * the built chunk must contain it. That fact lives in the environment, is read from there, and
 * cannot drift. It separates the two ways this gate can measure the wrong thing: a variable is
 * unset, or it is set and the path it gates did not survive the build. It also makes the
 * workflow's `${{ env.* }}` indirection safe to rely on -- an expansion that silently produced
 * an empty string reds this gate by name instead of shrinking its subject back.
 *
 * ## Three toolchains build one commit at three sizes
 *
 * All of `2f81de0`, measured 2026-09-09:
 *
 *   CI, variables unset, Node 22        424462
 *   local, shaped, Node 24              427601
 *   Vercel, shaped, real values         428939
 *
 * So Vercel builds ~1337 bytes heavier than this machine on the same source -- a different
 * figure from the ~332 bytes by which local measured heavier than CI on identical source
 * (GH#235), because that pair differs only in Node. Never read a local absolute against the
 * budget; compare a delta measured on one toolchain.
 *
 * The placeholder URL's length is part of the number. It was chosen to sit within one byte
 * of the configured value's: 62 characters against production's 63, so the two artefacts
 * differ in that literal by a single byte and in nothing else the bundler can see.
 *
 * ## The number
 *
 * It lives in package.json's `perf:budget` script. Re-derive it here, never guess it, and
 * record the base you derived it from.
 *
 * Current value, derived 2026-09-09: base 427601 -- this machine's own production-shaped
 * build of `main` -- rounded up 1% to 431900. CI is predicted at 427269 by the offset above,
 * so this leaves ~4.6 KB of headroom. That still catches what the gate guards against,
 * because an accidental static import of a library is ten kilobytes and upward, not five
 * hundred bytes.
 *
 * History: it was a ratchet set to a 2026-06 build, and by 2026-09-09 `main` measured 423195
 * against a budget of 423240. Forty-five bytes of headroom is not a budget: at that margin
 * the gate stops reporting on the thing it was written for and starts reporting on the length
 * of Tailwind class names. It failed two PRs whose growth was 521 and 746 bytes and contained
 * no new import at all -- 63 occurrences of `text-primary` becoming `text-primary-strong`
 * plus eleven `dark:` variants accounted for 749 of those bytes on their own. It was
 * re-derived to 428700 the same day, arithmetically correctly, from the wrong subject: a
 * bundle with neither the checkout path nor the ad injector in it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const max = Number(process.argv[2]);
if (!Number.isFinite(max)) throw new Error('usage: assert-entry-budget.mjs <maxBytes>');

/**
 * Variables whose value was measured *present* in the shipped entry chunk and *absent* from
 * a build made without it (2026-09-09, commit 2f81de0). Each gates a whole code path, so an
 * unset one does not merely change a runtime branch -- it removes the code from the file this
 * script weighs. They are named here rather than in the workflow because it is this script
 * that requires them; the workflow only satisfies the requirement.
 *
 * The two AdSense slot ids shape the build as well and are set alongside these in ci.yml, but
 * they are not listed: nothing measured says their values reach `app-*.js` rather than a route
 * chunk, and a control that can red on a correct build is worse than one gap fewer.
 */
const SHAPING_VARS = ['VITE_DODO_CHECKOUT_URL', 'VITE_ADSENSE_CLIENT'];

const missing = SHAPING_VARS.filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `unset: ${missing.join(', ')}\n` +
      'Each of those is substituted at build time, so with it unset Rollup eliminated the\n' +
      'code behind it and the build this would measure does not contain that path at all.\n' +
      'Its size is therefore not a bound on the file users download. Set them, rebuild, and\n' +
      "re-run. For a number comparable to CI use the values ci.yml's build step sets: the\n" +
      'budget includes their lengths.'
  );
  process.exit(1);
}

const assets = path.resolve('dist/assets');
const entry = readdirSync(assets).filter(f => /^app-.*\.js$/.test(f));
if (entry.length !== 1) throw new Error(`expected exactly one app-*.js, found ${entry.length}`);

const entryPath = path.join(assets, entry[0]);
const size = statSync(entryPath).size;
const contents = readFileSync(entryPath, 'utf8');

const eliminated = SHAPING_VARS.filter(name => !contents.includes(process.env[name]));
if (eliminated.length > 0) {
  console.error(
    `${entry[0]} does not contain the configured value of: ${eliminated.join(', ')}\n` +
      'So this dist/ was not built with the environment that is set right now. Either the\n' +
      'build predates these variables, or the path each one gates no longer reaches the\n' +
      'entry chunk. Rebuild first; if that does not fix it, the code this budget was written\n' +
      'to guard has moved out of app-*.js and the budget no longer measures it.'
  );
  process.exit(1);
}

console.log(`${entry[0]}: ${size} bytes (budget ${max})`);
if (size > max) {
  console.error(`entry bundle exceeds budget by ${size - max} bytes`);
  process.exit(1);
}
