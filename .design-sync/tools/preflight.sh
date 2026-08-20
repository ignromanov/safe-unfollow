#!/usr/bin/env bash
# Takes the repo from "nothing present" to "ready to sync" for design-sync.
#
# Everything this script does is documented in `.design-sync/NOTES.md` ("Two setup
# steps that are NOT in the repo and must be redone on a fresh clone", "Re-sync risks")
# but was, until this script existed, executed by nobody — each step lives under a
# gitignored path (`.ds-sync/`, `.design-sync/.cache/`, `.design-sync/node_modules`) so
# a fresh clone or a fresh worktree silently lacks all of them.
#
# Idempotent: safe to re-run. Does not run the converter itself — it prints the next
# command instead, since that step is what a re-sync actually varies on (component
# scope, `--force`, etc).
#
# Usage: bash .design-sync/tools/preflight.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# The design-sync skill's own directory changes with every Claude Code release (it is
# versioned into a path like .../bundled-skills/<version>/<hash>/design-sync/), so a
# hardcoded default rots. Override with DS_SKILL_DIR when it has moved.
DS_SKILL_DIR="${DS_SKILL_DIR:-/private/tmp/claude-501/bundled-skills/2.1.238/98ca0bdab7254c7c0cc94998cad9e60c/design-sync}"

if [ ! -d "$DS_SKILL_DIR" ]; then
  echo "ERROR: DS_SKILL_DIR does not exist: $DS_SKILL_DIR" >&2
  echo "The design-sync skill has likely moved to a new Claude Code version." >&2
  echo "Find its current path and re-run with: DS_SKILL_DIR=<path> bash $0" >&2
  exit 1
fi

echo "== 1/6: self-link (package-build.mjs resolves the DS at <node-modules>/<pkg>; in the package's own repo that path doesn't exist on its own) =="
ln -sfn .. node_modules/safe-unfollow

echo "== 2/6: staging the skill's converter into .ds-sync/ =="
mkdir -p .ds-sync
cp -r \
  "$DS_SKILL_DIR"/package-build.mjs \
  "$DS_SKILL_DIR"/package-validate.mjs \
  "$DS_SKILL_DIR"/package-capture.mjs \
  "$DS_SKILL_DIR"/resync.mjs \
  "$DS_SKILL_DIR"/lib \
  "$DS_SKILL_DIR"/storybook \
  .ds-sync/

echo "== 3/6: converter deps in .ds-sync/ =="
if [ ! -f .ds-sync/package.json ]; then
  echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
fi
if [ -d .ds-sync/node_modules/esbuild ] && [ -d .ds-sync/node_modules/ts-morph ] && [ -d .ds-sync/node_modules/@types/react ]; then
  echo "already installed, skipping npm i"
else
  (cd .ds-sync && npm i esbuild ts-morph @types/react)
fi

echo "== 4/6: fork symlink (.design-sync/overrides/dts.mjs needs it for its bare ts-morph import) =="
ln -sfn ../.ds-sync/node_modules .design-sync/node_modules

echo "== 5/6: compiling CSS =="
node .design-sync/tools/compile-css.mjs

echo "== 6/6: emitting .d.ts declarations =="
# tsc reports type errors here (types:[] drops vite/client, so import.meta.env is
# untyped) and emits anyway — that is expected, not a failure. See NOTES.md
# "'.d.ts' extraction needs BOTH a declaration emit and the dts.mjs fork".
npx tsc -p .design-sync/tools/tsconfig.dts.json || true

echo
echo "Preflight complete. Next command:"
echo "  node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle"
