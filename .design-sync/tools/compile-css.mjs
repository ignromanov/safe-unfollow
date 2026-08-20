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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcssPostcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

// Compile the wrapper, not `src/styles.css` directly — the wrapper adds `@source
// '../previews'` so utility classes used only by authored preview .tsx files still
// get generated (see NOTES.md "Authoring previews").
const entry = path.join(__dirname, "ds-tailwind.css");
const cacheDir = path.join(repoRoot, ".design-sync", ".cache");
const outCss = path.join(cacheDir, "app-compiled.css");
const outFonts = path.join(cacheDir, "fonts-alias.css");

fs.mkdirSync(cacheDir, { recursive: true });

const source = fs.readFileSync(entry, "utf8");

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

// --- font-family aliases -----------------------------------------------------------
//
// The app's own CSS requests bare family names it never declares: `--font-sans` and
// `.font-display` (`src/styles.css`) ask for 'Inter' / 'Plus Jakarta Sans', but the
// installed `@fontsource-variable/*` packages only declare the " Variable"-suffixed
// names ('Inter Variable', 'Plus Jakarta Sans Variable'). Without an alias, any preview
// that requests the bare name falls back silently to the system font — no error, just
// a component that renders in the wrong typeface.
//
// This is deliberately generic rather than a hardcoded two-entry map: any `@font-face`
// this build produces whose family ends in " Variable" gets a second declaration under
// the un-suffixed name, reusing the same `src`. If the app is ever fixed (e.g. it starts
// requesting the " Variable" names, or aliases them itself), this loop finds nothing to
// alias and the throw below fires on purpose — see NOTES.md "Re-sync risks".
const compiledRoot = postcss.parse(result.css, { from: outCss });
const aliasRoot = postcss.root();
const VARIABLE_SUFFIX = " Variable";

compiledRoot.walkAtRules("font-face", (rule) => {
  let familyDecl;
  rule.walkDecls("font-family", (decl) => {
    familyDecl = decl;
  });
  if (!familyDecl) return;

  const family = familyDecl.value.replace(/^['"]|['"]$/g, "");
  if (!family.endsWith(VARIABLE_SUFFIX)) return;

  const aliasFamily = family.slice(0, -VARIABLE_SUFFIX.length);
  const aliasRule = rule.clone();
  aliasRule.walkDecls("font-family", (decl) => {
    decl.value = `'${aliasFamily}'`;
  });
  aliasRoot.append(aliasRule);
});

const aliasCount = aliasRoot.nodes.length;

if (aliasCount === 0) {
  throw new Error(
    "compile-css.mjs: 0 font-family aliases emitted. This is deliberate, not a bug — " +
      "see NOTES.md \"Re-sync risks\": it means the app no longer requests a family name " +
      "it doesn't declare. Delete this alias step (and the `extraFonts` entry in " +
      "config.json) rather than working around the throw.",
  );
}

fs.writeFileSync(outFonts, aliasRoot.toString() + "\n");

console.log(`[compile-css] wrote ${path.relative(repoRoot, outCss)}`);
console.log(
  `[compile-css] wrote ${path.relative(repoRoot, outFonts)} (${aliasCount} alias${aliasCount === 1 ? "" : "es"})`,
);
