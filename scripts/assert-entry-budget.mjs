/**
 * Fails when the entry bundle grows past its budget. Without this, one new static import
 * at the root of the module graph silently puts back what this task removed, and nothing
 * in the test suite notices.
 *
 * Usage: node assert-entry-budget.mjs <maxBytes>
 *
 * The number lives in package.json's `perf:budget` script. Re-derive it here, never guess
 * it, and record the base you derived it from -- the previous value was a ratchet set to a
 * 2026-06 build and by 2026-09-09 `main` measured 423195 against a budget of 423240. Forty-
 * five bytes of headroom is not a budget: at that margin the gate stops reporting on the
 * thing it was written for and starts reporting on the length of Tailwind class names. It
 * failed two PRs whose growth was 521 and 746 bytes and contained no new import at all --
 * 63 occurrences of `text-primary` becoming `text-primary-strong` plus eleven `dark:`
 * variants accounted for 749 of those bytes on their own.
 *
 * Current value, derived 2026-09-09: 424462 (main at 423195 plus those two changes) rounded
 * up by 1% to 428700. That still catches what this guards against, because an accidental
 * static import of a library is ten kilobytes and upward, not five hundred bytes.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const max = Number(process.argv[2]);
if (!Number.isFinite(max)) throw new Error('usage: assert-entry-budget.mjs <maxBytes>');

const assets = path.resolve('dist/assets');
const entry = readdirSync(assets).filter(f => /^app-.*\.js$/.test(f));
if (entry.length !== 1) throw new Error(`expected exactly one app-*.js, found ${entry.length}`);

const size = statSync(path.join(assets, entry[0])).size;
console.log(`${entry[0]}: ${size} bytes (budget ${max})`);
if (size > max) {
  console.error(`entry bundle exceeds budget by ${size - max} bytes`);
  process.exit(1);
}
