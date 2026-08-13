/**
 * Fails when the entry bundle grows past its budget. Without this, one new static import
 * at the root of the module graph silently puts back what this task removed, and nothing
 * in the test suite notices.
 *
 * Usage: node assert-entry-budget.mjs <maxBytes>
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
