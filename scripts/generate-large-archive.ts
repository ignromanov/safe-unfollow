/* eslint-disable no-console */
/**
 * Large-Archive Fixture Generator
 *
 * Generates synthetic Instagram-export ZIPs that are large the way real
 * rejected exports are large: by ENTRY COUNT and BYTE SIZE, not by account
 * count. `raw/synthetic/generate-test-data.ts` scales by account count and
 * tops out at a 15 MB zip for 1,000,000 accounts — real exports are large
 * because of thousands of media files, which that generator never produces.
 *
 * Two axes, two preset families (`--list` prints both):
 *   - size-*     : total archive byte size, bracketing the measured rejected
 *                  uploads (median 863 MB, p90 2308 MB, max 2848 MB).
 *   - entries-*  : entry count around the 65,535 non-ZIP64 boundary and the
 *                  parser's own MAX_ZIP_ENTRIES=200,000 guard
 *                  (see src/core/parsers/instagram.ts).
 *
 * Every fixture is a valid Instagram "connections" export (the real JSON
 * files, copied from an existing generated dataset) plus ballast entries
 * under media/ standing in for the media files real exports carry.
 *
 * Written from scratch rather than with @zip.js/zip.js (the library the app
 * reads archives with) or JSZip: a bug shared between writer and reader would
 * cancel out and prove nothing, and no library will emit the deliberately
 * malformed entries-65537-no-zip64 fixture on request. Only STORED entries
 * are needed (ballast is incompressible pseudo-random data, and stored is
 * also what makes the output size exactly predictable), so the format
 * amounts to local file headers + a central directory + an EOCD record —
 * small enough to hand-roll correctly.
 *
 * Run:
 *   npx tsx scripts/generate-large-archive.ts --list
 *   npx tsx scripts/generate-large-archive.ts                  # default set
 *   npx tsx scripts/generate-large-archive.ts size-2308mb --force
 *   npx tsx scripts/generate-large-archive.ts --all
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { once } from 'events';
import type { WriteStream } from 'fs';

// === Constants ===

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Hardcoded rather than derived from `import.meta.url`: this script lives in
// a git worktree (`.worktrees/zip-random-access/scripts/`), but `raw/` is
// gitignored and only exists in the main checkout — a worktree has none of
// its own. A relative `../raw` here would silently create/read the wrong
// directory. See `--out=`/`--connections=` to override either.
const MAIN_CHECKOUT = '/Users/ignat/code/safe-unfollow';
const DEFAULT_OUT_ROOT = join(MAIN_CHECKOUT, 'raw', 'synthetic');
const DEFAULT_CONNECTIONS_ROOT = join(MAIN_CHECKOUT, 'raw', 'synthetic', 'regular-3k', 'unpacked');

// Matches the real export layout: connections/followers_and_following/*.json.
const CONNECTIONS_SUBDIR = 'connections/followers_and_following';

// The 9 files a real export carries there. Not all of them are read by the
// parser (custom_lists.json notably isn't — see instagram-optional.ts) but
// all 9 are present in a real export, so a faithful fixture copies whichever
// of these the source dataset actually has.
const EXPECTED_CONNECTIONS_FILES = [
  'following.json',
  'followers_1.json',
  'close_friends.json',
  'pending_follow_requests.json',
  'removed_suggestions.json',
  'recent_follow_requests.json',
  'restricted_profiles.json',
  'recently_unfollowed_profiles.json',
  'custom_lists.json',
];

// Fixed instead of `new Date()`: byte-identical reruns require a fixed DOS
// timestamp, not just a fixed PRNG seed.
const FIXED_MTIME = new Date('2026-08-19T00:00:00Z');

const MAX_16_BIT = 0xffff;
const MAX_32_BIT = 0xffffffff;

// === Presets ===

interface SizePreset {
  readonly kind: 'size';
  readonly name: string;
  readonly targetBytes: number;
  readonly proves: string;
}

interface EntriesPreset {
  readonly kind: 'entries';
  readonly name: string;
  readonly totalEntries: number;
  /**
   * 'no'            — count fits in the plain 16-bit EOCD field, no ZIP64.
   * 'yes'           — count needs ZIP64, written correctly.
   * 'no-malformed'  — count needs ZIP64 but none is written; the EOCD's
   *                   16-bit field carries `totalEntries % 65536`, the risk
   *                   PR #80 documents (zip-reader.js:276 trusts that field).
   */
  readonly zip64: 'yes' | 'no' | 'no-malformed';
  readonly entryBytes: number;
  readonly proves: string;
}

type Preset = SizePreset | EntriesPreset;

const SIZE_PRESETS: SizePreset[] = [
  {
    kind: 'size',
    name: 'size-501mb',
    targetBytes: 501 * MB,
    proves: 'one megabyte past the deleted 500 MB ceiling',
  },
  {
    kind: 'size',
    name: 'size-863mb',
    targetBytes: 863 * MB,
    proves: 'measured median rejected file (24 Jul – 18 Aug 2026)',
  },
  {
    kind: 'size',
    name: 'size-2308mb',
    targetBytes: 2308 * MB,
    proves: 'measured p90 rejected file',
  },
  {
    kind: 'size',
    name: 'size-2848mb',
    targetBytes: 2848 * MB,
    proves: 'largest rejected file observed',
  },
];

const ENTRIES_PRESETS: EntriesPreset[] = [
  {
    kind: 'entries',
    name: 'entries-65535',
    totalEntries: 65535,
    zip64: 'no',
    entryBytes: 1024,
    proves: 'the last count a non-ZIP64 EOCD can state truthfully',
  },
  {
    kind: 'entries',
    name: 'entries-65537-zip64',
    totalEntries: 65537,
    zip64: 'yes',
    entryBytes: 1024,
    proves: 'the correct path above the boundary — must parse normally',
  },
  {
    kind: 'entries',
    name: 'entries-65537-no-zip64',
    totalEntries: 65537,
    zip64: 'no-malformed',
    entryBytes: 1024,
    proves:
      'the risk PR #80 documents and does not guard: EOCD count wraps to 1, the archive reads short, and the failure must be loud (NOT_INSTAGRAM_EXPORT), not a silently wrong follower list',
  },
  {
    kind: 'entries',
    name: 'entries-200000',
    totalEntries: 200_000,
    zip64: 'yes',
    entryBytes: 1024,
    proves: 'exactly at MAX_ZIP_ENTRIES — must parse',
  },
  {
    kind: 'entries',
    name: 'entries-200001',
    totalEntries: 200_001,
    zip64: 'yes',
    entryBytes: 1024,
    proves: 'one over MAX_ZIP_ENTRIES — must produce TOO_MANY_ENTRIES',
  },
];

const ALL_PRESETS: Preset[] = [...ENTRIES_PRESETS, ...SIZE_PRESETS];

// The three multi-GB fixtures (~5.7 GB combined) — excluded from the default
// run and must be named explicitly, or requested with --all.
const BIG_PRESET_NAMES = new Set(['size-501mb', 'size-2308mb', 'size-2848mb']);

const DEFAULT_PRESET_NAMES = [...ENTRIES_PRESETS.map(p => p.name), 'size-863mb'];

// === CRC-32 (needed for local file / central directory headers) ===

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const tableEntry = CRC_TABLE[(crc ^ buf[i]!) & 0xff]!;
    crc = tableEntry ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// === Deterministic pseudo-random ballast ===

/** xorshift32 — fast, deterministic, and its output does not deflate. */
function xorshift32(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state >>> 0;
  };
}

function fillRandom(buf: Uint8Array, rng: () => number): void {
  let i = 0;
  while (i + 4 <= buf.length) {
    const v = rng();
    buf[i++] = v & 0xff;
    buf[i++] = (v >>> 8) & 0xff;
    buf[i++] = (v >>> 16) & 0xff;
    buf[i++] = (v >>> 24) & 0xff;
  }
  while (i < buf.length) {
    buf[i++] = rng() & 0xff;
  }
}

/** Turns a preset name into a stable numeric seed, printed with the run. */
function seedFromName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// === DOS date/time ===

function toDosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getUTCSeconds() >> 1) | (date.getUTCMinutes() << 5) | (date.getUTCHours() << 11);
  const dosDate =
    date.getUTCDate() | ((date.getUTCMonth() + 1) << 5) | ((date.getUTCFullYear() - 1980) << 9);
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

// === Minimal streaming ZIP writer ===

interface CentralRecord {
  readonly name: string;
  readonly crc32: number;
  readonly size: number;
  readonly offset: number;
}

/**
 * Writes local file headers + data as entries arrive, keeps only the small
 * central-directory bookkeeping in memory, and emits the central directory
 * and EOCD (or ZIP64 EOCD + locator + EOCD) at the end. Never buffers more
 * than one entry's data at a time.
 */
class ZipBuilder {
  private readonly stream: WriteStream;
  private offset = 0;
  private readonly records: CentralRecord[] = [];
  private readonly dosTime: number;
  private readonly dosDate: number;

  constructor(outPath: string) {
    this.stream = createWriteStream(outPath);
    const { time, date } = toDosDateTime(FIXED_MTIME);
    this.dosTime = time;
    this.dosDate = date;
  }

  async addEntry(name: string, data: Uint8Array): Promise<void> {
    const nameBuf = Buffer.from(name, 'ascii');
    const crc = crc32(data);
    const size = data.length;
    if (size > MAX_32_BIT) {
      throw new Error(`Entry too large for this writer (no per-entry ZIP64 extra field): ${name}`);
    }

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed to extract
    header.writeUInt16LE(0, 6); // general purpose flag
    header.writeUInt16LE(0, 8); // compression method: stored
    header.writeUInt16LE(this.dosTime, 10);
    header.writeUInt16LE(this.dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(size, 18); // compressed size
    header.writeUInt32LE(size, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // extra field length

    const localHeaderOffset = this.offset;
    await this.write(header);
    await this.write(nameBuf);
    await this.write(data);
    this.offset += header.length + nameBuf.length + size;

    this.records.push({ name, crc32: crc, size, offset: localHeaderOffset });
  }

  private async write(buf: Uint8Array): Promise<void> {
    if (!this.stream.write(buf)) {
      await once(this.stream, 'drain');
    }
  }

  /**
   * @param mode 'auto' picks ZIP64 iff the entry count or an offset/size
   *   exceeds what the plain fields can hold. 'force-malformed-count' never
   *   writes ZIP64 and instead writes `entries % 65536` into the plain
   *   16-bit count field — the entries-65537-no-zip64 fixture's whole point.
   */
  async finish(mode: 'auto' | 'force-malformed-count'): Promise<{ zip64: boolean; declaredEntries: number }> {
    const cdStart = this.offset;
    for (const rec of this.records) {
      const nameBuf = Buffer.from(rec.name, 'ascii');
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0); // central file header signature
      header.writeUInt16LE(20, 4); // version made by
      header.writeUInt16LE(20, 6); // version needed to extract
      header.writeUInt16LE(0, 8); // general purpose flag
      header.writeUInt16LE(0, 10); // compression method: stored
      header.writeUInt16LE(this.dosTime, 12);
      header.writeUInt16LE(this.dosDate, 14);
      header.writeUInt32LE(rec.crc32, 16);
      header.writeUInt32LE(rec.size, 20);
      header.writeUInt32LE(rec.size, 24);
      header.writeUInt16LE(nameBuf.length, 28);
      header.writeUInt16LE(0, 30); // extra field length
      header.writeUInt16LE(0, 32); // file comment length
      header.writeUInt16LE(0, 34); // disk number start
      header.writeUInt16LE(0, 36); // internal file attributes
      header.writeUInt32LE(0, 38); // external file attributes
      header.writeUInt32LE(rec.offset, 42); // relative offset of local header
      await this.write(header);
      await this.write(nameBuf);
      this.offset += header.length + nameBuf.length;
    }
    const cdSize = this.offset - cdStart;
    const totalEntries = this.records.length;

    if (mode === 'force-malformed-count') {
      const declared = totalEntries % 65536;
      await this.writeEocd(declared, declared, cdSize, cdStart);
      await this.end();
      return { zip64: false, declaredEntries: declared };
    }

    const needsZip64 = totalEntries > MAX_16_BIT || cdStart > MAX_32_BIT || cdSize > MAX_32_BIT;
    if (needsZip64) {
      const zip64EocdOffset = this.offset;
      const zip64Eocd = Buffer.alloc(56);
      zip64Eocd.writeUInt32LE(0x06064b50, 0); // zip64 EOCD signature
      zip64Eocd.writeBigUInt64LE(44n, 4); // size of remaining record
      zip64Eocd.writeUInt16LE(45, 12); // version made by
      zip64Eocd.writeUInt16LE(45, 14); // version needed to extract
      zip64Eocd.writeUInt32LE(0, 16); // number of this disk
      zip64Eocd.writeUInt32LE(0, 20); // disk with CD start
      zip64Eocd.writeBigUInt64LE(BigInt(totalEntries), 24); // entries on this disk
      zip64Eocd.writeBigUInt64LE(BigInt(totalEntries), 32); // total entries
      zip64Eocd.writeBigUInt64LE(BigInt(cdSize), 40); // size of central directory
      zip64Eocd.writeBigUInt64LE(BigInt(cdStart), 48); // offset of start of CD
      await this.write(zip64Eocd);

      const zip64Locator = Buffer.alloc(20);
      zip64Locator.writeUInt32LE(0x07064b50, 0); // zip64 EOCD locator signature
      zip64Locator.writeUInt32LE(0, 4); // disk with zip64 EOCD start
      zip64Locator.writeBigUInt64LE(BigInt(zip64EocdOffset), 8); // offset of zip64 EOCD
      zip64Locator.writeUInt32LE(1, 16); // total number of disks
      await this.write(zip64Locator);

      await this.writeEocd(MAX_16_BIT, MAX_16_BIT, cdSize, cdStart);
    } else {
      await this.writeEocd(totalEntries, totalEntries, cdSize, cdStart);
    }
    await this.end();
    return { zip64: needsZip64, declaredEntries: needsZip64 ? MAX_16_BIT : totalEntries };
  }

  private async writeEocd(
    entriesThisDisk: number,
    totalEntries: number,
    cdSize: number,
    cdStart: number
  ): Promise<void> {
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // disk with CD start
    eocd.writeUInt16LE(entriesThisDisk, 8);
    eocd.writeUInt16LE(totalEntries, 10);
    eocd.writeUInt32LE(cdSize > MAX_32_BIT ? MAX_32_BIT : cdSize, 12);
    eocd.writeUInt32LE(cdStart > MAX_32_BIT ? MAX_32_BIT : cdStart, 16);
    eocd.writeUInt16LE(0, 20); // comment length
    await this.write(eocd);
  }

  private async end(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}

// === Connections files ===

interface ConnectionsFile {
  readonly name: string; // archive path, e.g. connections/followers_and_following/following.json
  readonly data: Buffer;
}

function loadConnectionsFiles(connectionsRoot: string): ConnectionsFile[] {
  const dir = join(connectionsRoot, ...CONNECTIONS_SUBDIR.split('/'));
  if (!existsSync(dir)) {
    console.error(`Connections directory not found: ${dir}`);
    console.error(
      'Regenerate it first, e.g.: npx tsx raw/synthetic/generate-test-data.ts regular ' +
        '--format=wrapper --value-field=title --output=raw/synthetic/regular-3k/unpacked'
    );
    process.exit(1);
  }
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    console.error(`No .json files found in ${dir}`);
    process.exit(1);
  }
  const missing = EXPECTED_CONNECTIONS_FILES.filter(f => !files.includes(f));
  if (missing.length > 0) {
    console.warn(
      `Source dataset at ${dir} is missing: ${missing.join(', ')} — continuing with the ${files.length} files present.`
    );
  }
  return files.map(f => ({
    name: `${CONNECTIONS_SUBDIR}/${f}`,
    data: readFileSync(join(dir, f)),
  }));
}

// === Ballast ===

function ballastName(index: number): string {
  return `media/posts/202508/${index}.jpg`;
}

async function writeBallastEntry(
  builder: ZipBuilder,
  index: number,
  seed: number,
  size: number
): Promise<void> {
  const buf = Buffer.allocUnsafe(size);
  const rng = xorshift32((seed ^ Math.imul(index + 1, 2654435761)) >>> 0);
  fillRandom(buf, rng);
  await builder.addEntry(ballastName(index), buf);
}

/** Local-only overhead estimate (header + central-directory bytes) used to hit an exact total archive size. */
function estimateOverheadBytes(names: string[]): number {
  let total = 22; // EOCD; ZIP64 records are not needed for the size family (entry counts stay in the hundreds/low thousands)
  for (const n of names) {
    const len = Buffer.byteLength(n, 'ascii');
    total += 30 + len; // local file header
    total += 46 + len; // central directory header
  }
  return total;
}

// === Building one archive ===

interface BuildResult {
  readonly outPath: string;
  readonly declaredEntries: number;
  readonly realEntries: number;
  readonly zip64: boolean;
  readonly bytes: number;
  readonly ms: number;
}

async function buildEntriesArchive(
  preset: EntriesPreset,
  connections: ConnectionsFile[],
  outPath: string
): Promise<BuildResult> {
  const start = Date.now();
  const builder = new ZipBuilder(outPath);
  const seed = seedFromName(preset.name);
  const ballastCount = preset.totalEntries - connections.length;

  if (preset.zip64 === 'no-malformed') {
    // One ballast entry first, deliberately. The malformed EOCD reports only
    // 1 entry, and the reader returns exactly the FIRST physical entry in
    // the central directory (see zip-reader.js's `for (indexFile <
    // filesLength)` loop) — never a truncated read of many. Putting a
    // connections file there would make the parser see a lone
    // following.json with no followers file, which is a *different*,
    // misleading failure. A ballast entry there guarantees the one entry
    // the truncated reader can see is not an Instagram export at all, so
    // the result is unambiguously NOT_INSTAGRAM_EXPORT.
    await writeBallastEntry(builder, 0, seed, preset.entryBytes);
    for (const f of connections) await builder.addEntry(f.name, f.data);
    for (let i = 1; i < ballastCount; i++) await writeBallastEntry(builder, i, seed, preset.entryBytes);
  } else {
    // Connections first, matching the real export layout.
    for (const f of connections) await builder.addEntry(f.name, f.data);
    for (let i = 0; i < ballastCount; i++) await writeBallastEntry(builder, i, seed, preset.entryBytes);
  }

  const mode = preset.zip64 === 'no-malformed' ? 'force-malformed-count' : 'auto';
  const { zip64, declaredEntries } = await builder.finish(mode);
  const bytes = statSync(outPath).size;
  return {
    outPath,
    declaredEntries,
    realEntries: preset.totalEntries,
    zip64,
    bytes,
    ms: Date.now() - start,
  };
}

async function buildSizeArchive(
  preset: SizePreset,
  connections: ConnectionsFile[],
  outPath: string
): Promise<BuildResult> {
  const start = Date.now();
  const NUM_BALLAST_ENTRIES = 1000; // "few hundred to few thousand", sized to the byte target

  const names = [
    ...connections.map(f => f.name),
    ...Array.from({ length: NUM_BALLAST_ENTRIES }, (_, i) => ballastName(i)),
  ];
  const connectionsBytes = connections.reduce((sum, f) => sum + f.data.length, 0);
  const overhead = estimateOverheadBytes(names);
  const ballastTotal = Math.max(0, preset.targetBytes - connectionsBytes - overhead);
  const per = Math.floor(ballastTotal / NUM_BALLAST_ENTRIES);
  const sizes = new Array<number>(NUM_BALLAST_ENTRIES).fill(per);
  // Remainder on the last entry so the produced file lands exactly on target.
  sizes[NUM_BALLAST_ENTRIES - 1] = per + (ballastTotal - per * NUM_BALLAST_ENTRIES);

  const builder = new ZipBuilder(outPath);
  const seed = seedFromName(preset.name);
  for (const f of connections) await builder.addEntry(f.name, f.data);
  for (let i = 0; i < NUM_BALLAST_ENTRIES; i++) {
    await writeBallastEntry(builder, i, seed, sizes[i]!);
  }
  const { zip64, declaredEntries } = await builder.finish('auto');
  const bytes = statSync(outPath).size;
  return {
    outPath,
    declaredEntries,
    realEntries: connections.length + NUM_BALLAST_ENTRIES,
    zip64,
    bytes,
    ms: Date.now() - start,
  };
}

// === Cross-check with a third, independent implementation (Info-ZIP unzip) ===

function unzipList(zipPath: string): string {
  try {
    return execFileSync('unzip', ['-l', zipPath], { encoding: 'utf-8', maxBuffer: 64 * MB });
  } catch (err) {
    const e = err as { stdout?: string; message: string };
    return e.stdout && e.stdout.length > 0 ? e.stdout : `unzip -l failed: ${e.message}`;
  }
}

// === CLI ===

function printPresetsTable(): void {
  console.log('Entry-count family:');
  for (const p of ENTRIES_PRESETS) {
    console.log(`  ${p.name.padEnd(24)} entries=${p.totalEntries} zip64=${p.zip64.padEnd(13)} ${p.proves}`);
  }
  console.log('\nSize family:');
  for (const p of SIZE_PRESETS) {
    const big = BIG_PRESET_NAMES.has(p.name) ? ' [multi-GB, name explicitly or --all]' : '';
    console.log(`  ${p.name.padEnd(24)} target=${(p.targetBytes / MB).toFixed(0)}MB${big} — ${p.proves}`);
  }
  console.log(`\nDefault (no args): ${DEFAULT_PRESET_NAMES.join(', ')}`);
}

function findPreset(name: string): Preset | undefined {
  return ALL_PRESETS.find(p => p.name === name);
}

function formatBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  return `${(n / MB).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let outRoot = DEFAULT_OUT_ROOT;
  let connectionsRoot = DEFAULT_CONNECTIONS_ROOT;
  let force = false;
  let all = false;
  let list = false;
  const presetNames: string[] = [];

  for (const arg of args) {
    if (arg === '--list') list = true;
    else if (arg === '--all') all = true;
    else if (arg === '--force') force = true;
    else if (arg.startsWith('--out=')) outRoot = arg.slice('--out='.length);
    else if (arg.startsWith('--connections=')) connectionsRoot = arg.slice('--connections='.length);
    else if (arg.startsWith('--')) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    } else presetNames.push(arg);
  }

  if (list) {
    printPresetsTable();
    return;
  }

  let selected: Preset[];
  if (presetNames.length > 0) {
    selected = presetNames.map(name => {
      const preset = findPreset(name);
      if (!preset) {
        console.error(`Unknown preset: ${name}. Run with --list to see valid names.`);
        process.exit(1);
      }
      return preset;
    });
  } else if (all) {
    selected = ALL_PRESETS;
  } else {
    selected = DEFAULT_PRESET_NAMES.map(name => findPreset(name)!);
  }

  const estimatedBytes = selected.reduce((sum, p) => {
    if (p.kind === 'size') return sum + p.targetBytes;
    return sum + p.totalEntries * p.entryBytes;
  }, 0);
  console.log(`Presets to generate: ${selected.map(p => p.name).join(', ')}`);
  console.log(`Estimated disk cost: ~${formatBytes(estimatedBytes)}\n`);

  const connections = loadConnectionsFiles(connectionsRoot);
  console.log(
    `Connections source: ${connectionsRoot} (${connections.length}/${EXPECTED_CONNECTIONS_FILES.length} expected files)\n`
  );

  for (const preset of selected) {
    const dir = join(outRoot, preset.name);
    const outPath = join(dir, `${preset.name}.zip`);
    if (existsSync(outPath) && !force) {
      console.log(`Skipping ${preset.name} — ${outPath} already exists (--force to regenerate)`);
      continue;
    }
    mkdirSync(dir, { recursive: true });

    const seed = seedFromName(preset.name);
    console.log(`Generating ${preset.name} (seed=${seed}) -> ${outPath}`);
    const result =
      preset.kind === 'size'
        ? await buildSizeArchive(preset, connections, outPath)
        : await buildEntriesArchive(preset, connections, outPath);

    console.log(
      `  done in ${(result.ms / 1000).toFixed(1)}s — ${formatBytes(result.bytes)}, ` +
        `${result.realEntries.toLocaleString()} real entries, ` +
        `EOCD declares ${result.declaredEntries.toLocaleString()}, ` +
        `zip64=${result.zip64}\n`
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export { unzipList };
