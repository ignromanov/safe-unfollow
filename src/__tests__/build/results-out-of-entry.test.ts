import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';
import { describeDist } from '../utils/dist-gate';

/**
 * GH#292: `/results` and `/sample` live in route chunks, not in `app-*.js`.
 *
 * Every visitor of every page downloads the entry chunk, and ~85% of them are on mobile.
 * Until this change it carried the whole results stack (virtualizer, rows, follow-date line,
 * caveats) that none of `/`, `/upload` or the intent pages ever runs, and `perf:budget` had
 * 40 bytes of headroom left because of it.
 *
 * Moving a page to `lazy` is only half the change. The other half is that a reader who lands
 * directly on `/results` must not pay a module waterfall for it (the reason `8af34d1` made
 * every route static). vite-react-ssg, in its default `remix` router mode, writes a
 * `modulepreload` for the chunks a prerendered route rendered, so the route chunk downloads
 * in parallel with the entry. That is asserted here per page, because it is a property of the
 * build, not of our source: a library upgrade can drop it without any diff in this repository.
 *
 * Markers are string literals from the module named beside each, chosen because they survive
 * minification. Each carries its own control — it must occur in *some* built chunk — so a
 * renamed string fails here by name instead of turning "absent from the entry" into a pass.
 */
const dist = resolve(__dirname, '../../../dist');
const manifestPath = join(dist, '.vite/manifest.json');
const built = existsSync(join(dist, 'index.html')) && existsSync(manifestPath);

const MARKERS: Record<string, string> = {
  'AccountListSection.tsx': 'filters.openSheetWithCount',
  'AccountList.tsx': 'empty.filteredTitle',
  'AccountList.tsx (virtualizer)': 'measureElement',
  'StaleDatesHint.tsx': 'dates.staleHint',
  'SamplePage.tsx': 'Preparing 1,180 demo accounts',
};

type ManifestChunk = { file: string; isEntry?: boolean; isDynamicEntry?: boolean };

describeDist(
  'results and sample are route chunks, preloaded only where they render (GH#292)',
  built,
  () => {
    const manifest = (): Record<string, ManifestChunk> =>
      JSON.parse(readFileSync(manifestPath, 'utf8'));
    const assets = join(dist, 'assets');
    const jsFiles = () => readdirSync(assets).filter(f => f.endsWith('.js'));
    const entryFile = () => {
      const entries = jsFiles().filter(f => /^app-.*\.js$/.test(f));
      expect(entries).toHaveLength(1);
      return entries[0];
    };
    const read = (file: string) => readFileSync(join(assets, file), 'utf8');
    const pageChunk = (page: string) => {
      const record = manifest()[`src/pages/${page}.tsx`];
      expect(record, `${page} has no manifest record of its own, so it was inlined`).toBeDefined();
      return record;
    };

    it.each(['ResultsPage', 'SamplePage'])('%s is a dynamic entry of its own', page => {
      const record = pageChunk(page);
      expect(record.isDynamicEntry).toBe(true);
      expect(record.file).not.toBe(`assets/${entryFile()}`);
    });

    it.each(Object.entries(MARKERS))('%s left the entry chunk', (_module, marker) => {
      const holders = jsFiles().filter(f => read(f).includes(marker));
      // Control: the marker survived the build somewhere, so its absence below means something.
      expect(
        holders.length,
        `"${marker}" is in no built chunk — rename the marker`
      ).toBeGreaterThan(0);
      expect(holders).not.toContain(entryFile());
    });

    it.each([
      ['results.html', 'ResultsPage'],
      ['id/results.html', 'ResultsPage'],
      ['sample.html', 'SamplePage'],
    ])('%s preloads its route chunk, so a direct load pays no waterfall', (html, page) => {
      const href = `/${pageChunk(page).file}`;
      const doc = readFileSync(join(dist, html), 'utf8');
      expect(doc).toContain(`<link rel="modulepreload" crossorigin href="${href}">`);
    });

    it.each(['results.html', 'id/results.html', 'sample.html'])(
      '%s preloads nothing the route only loads on demand',
      html => {
        // vite-react-ssg walks dynamicImports too; `dropDynamicOnlyPreloads` strips them. Left in,
        // the export dialog, paywall and licence dialog cost a direct /results load 136 ms of LCP.
        // Locale chunks are dynamic entries too, and are preloaded on purpose by
        // `localeChunkHrefs` (locale-preload.test.ts), so they are not on demand here.
        const onDemand = Object.entries(manifest()).filter(
          ([key, chunk]) =>
            chunk.isDynamicEntry && !key.startsWith('src/pages/') && !key.startsWith('_locale-')
        );
        // Control: such chunks exist, so "none is preloaded" is not vacuous.
        expect(onDemand.map(([key]) => key)).toContain('src/components/export/ExportDialog.tsx');
        const doc = readFileSync(join(dist, html), 'utf8');
        for (const [key, chunk] of onDemand) expect(doc, key).not.toContain(chunk.file);
      }
    );

    it.each(['index.html', 'upload.html', 'id/upload.html', 'privacy.html'])(
      '%s does not preload the results chunk',
      html => {
        const doc = readFileSync(join(dist, html), 'utf8');
        // Control: the page does carry preloads, so the absence is not a missing <head>.
        expect(doc).toContain('rel="modulepreload"');
        expect(doc).not.toContain(pageChunk('ResultsPage').file);
      }
    );
  }
);
