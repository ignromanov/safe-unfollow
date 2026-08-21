#!/usr/bin/env node
// Compiles the app's Tailwind v4 source into a design-sync `cssEntry`.
//
// Why this exists: `src/styles.css` is a Tailwind v4 SOURCE file
// (`@import 'tailwindcss'`). esbuild — what the design-sync converter uses to bundle
// components — cannot resolve that import (Tailwind v4 exposes `.` only under the
// `style` export condition), so pointing `cssEntry` at the source directly breaks the
// build with `Could not resolve "tailwindcss"`. This script runs the same
// `@tailwindcss/postcss` pipeline the app itself uses (see `postcss.config.js`) ahead
// of time, and writes the result to a stable, reproducible path.
//
// See `.design-sync/NOTES.md` — "cssEntry must be COMPILED Tailwind v4" and
// "Re-sync risks" — for the failure modes this script exists to avoid.
//
// Usage: node .design-sync/tools/compile-css.mjs   (run from the repo root)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcssPostcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// Compile the wrapper, not `src/styles.css` directly — the wrapper adds `@source
// '../previews'` so utility classes used only by authored preview .tsx files still
// get generated (see NOTES.md "Authoring previews").
const entry = path.join(__dirname, 'ds-tailwind.css');
const cacheDir = path.join(repoRoot, '.design-sync', '.cache');
const outCss = path.join(cacheDir, 'app-compiled.css');
const outFonts = path.join(cacheDir, 'fonts-alias.css');

fs.mkdirSync(cacheDir, { recursive: true });

const source = fs.readFileSync(entry, 'utf8');

// `from`/`to` matter beyond diagnostics: Tailwind v4's own @import handling rebases
// the relative `url()`s it inlines (font files, etc.) against `to`, so the compiled
// CSS at `.design-sync/.cache/` resolves them back into `node_modules/` correctly.
const result = await postcss([tailwindcssPostcss(), autoprefixer()]).process(source, {
  from: entry,
  to: outCss,
});

for (const warning of result.warnings()) {
  console.warn(`[compile-css] ${warning.toString()}`);
}

fs.writeFileSync(outCss, result.css);
if (result.map) {
  fs.writeFileSync(`${outCss}.map`, result.map.toString());
}

// --- font presence guard ------------------------------------------------------------
//
// This block used to emit bare-name ALIASES: the app asked for 'Inter' / 'Plus Jakarta
// Sans' while `@fontsource-variable/*` declares only the " Variable"-suffixed names, and
// CSS family matching is exact. PR #105 (`d4e5416`, 2026-08-20) fixed the app to request
// the declared names, so nothing asks for the bare ones any more — the aliases became
// dead output and are gone.
//
// What replaced them is the check, not the emission. The same PR moved the two
// `@fontsource` imports out of `src/styles.css` into `src/main.tsx`, and the design-sync
// bundle never executes `main.tsx`. On 2026-08-21 that left `app-compiled.css` with ZERO
// `@font-face` rules and every card screenshotting in the system fallback — silently,
// because a missing font is never an error anywhere. `ds-tailwind.css` now imports both
// packages itself; this guard is what makes a regression of that loud.
//
// If it fires, the fix is in `ds-tailwind.css`, not here.

const faceCount = postcss
  .parse(result.css, { from: outCss })
  .nodes.filter(n => n.type === 'atrule' && n.name === 'font-face').length;

if (faceCount === 0) {
  throw new Error(
    'compile-css.mjs: the compiled stylesheet contains 0 @font-face rules, so every ' +
      'design-sync card would render in the system fallback. The app imports its ' +
      'webfonts from src/main.tsx (PR #105), which this CSS-only pipeline never runs, ' +
      'so .design-sync/tools/ds-tailwind.css must import them itself. Check that its ' +
      "@import lines for '@fontsource-variable/*' are still present and still resolve."
  );
}

console.log(`[compile-css] wrote ${path.relative(repoRoot, outCss)} (${faceCount} @font-face)`);

// --- bare-name aliases, for the DESIGN PROJECT's hand-authored cards -----------------
//
// These were deleted on 2026-08-21 and restored the same day, because the reason they
// exist is not the reason that was written down. Recording both, since the wrong one is
// the intuitive one:
//
// The comment here used to say the aliases bridged the APP's mistake — `src/styles.css`
// asked for 'Inter' while `@fontsource-variable/*` declares only 'Inter Variable'. PR
// #105 fixed that, so the app-side justification is genuinely dead and deleting on that
// basis looked correct.
//
// It was not. The live consumer is the Claude Design project, which pre-dates this sync
// and holds 28 HAND-AUTHORED files — all 18 `foundations/*.card.html`, all 5
// `catalog/*.card.html`, `ui_kits/app/index.html` and the 4 `templates/conversion-audit`
// mockups — whose own CSS requests the BARE names. The converter overwrites the project's
// shared `styles.css` and `fonts/fonts.css` on every upload, so dropping these aliases
// silently removes the only faces those 28 files match. Verified against the project on
// 2026-08-21: its `fonts/fonts.css` carries 22 faces, 11 suffixed and 11 bare, and the
// bare set is load-bearing.
//
// This is the exact coupling NOTES.md flags under "NEVER reconcile-delete": a `cssEntry`
// change unstyles hand-authored cards and no converter check catches it. The check that
// would catch it does not live in this repo, which is why it is written here instead.
//
// Do not delete this step because the app no longer needs it. Delete it only when those
// 28 files are confirmed to ask for the suffixed names.
const aliasRoot = postcss.root();
const VARIABLE_SUFFIX = ' Variable';

postcss.parse(result.css, { from: outCss }).walkAtRules('font-face', rule => {
  let familyDecl;
  rule.walkDecls('font-family', decl => {
    familyDecl = decl;
  });
  if (!familyDecl) return;

  const family = familyDecl.value.replace(/^['"]|['"]$/g, '');
  if (!family.endsWith(VARIABLE_SUFFIX)) return;

  const aliasRule = rule.clone();
  aliasRule.walkDecls('font-family', decl => {
    decl.value = `'${family.slice(0, -VARIABLE_SUFFIX.length)}'`;
  });
  aliasRoot.append(aliasRule);
});

fs.writeFileSync(outFonts, aliasRoot.toString());
console.log(
  `[compile-css] wrote ${path.relative(repoRoot, outFonts)} (${aliasRoot.nodes.length} aliases)`
);
