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

# Where the design-sync skill lives. This is the one input this script cannot own, and
# the first version of it got that wrong: it hardcoded
# /private/tmp/claude-501/bundled-skills/2.1.238/<hash>/design-sync and anticipated only
# version drift. Within a day the whole `bundled-skills/` tree was gone from /private/tmp
# — bundled skills are extracted on demand and the tree is temp storage, so it is evicted,
# not just renamed. The script then died at step 2 printing a remedy ("find its current
# path") that had nowhere to point.
#
# So: search rather than assume, and never make the failure fatal while a working copy of
# the converter is already staged.
if [ -z "${DS_SKILL_DIR:-}" ]; then
  DS_SKILL_DIR="$(
    find /private/tmp/claude-501 /tmp/claude-"$(id -u)" "$HOME/.claude" \
      -maxdepth 6 -type d -name design-sync 2>/dev/null | head -1
  )"
fi

# .ds-sync/ is a full, self-sufficient copy of the converter once step 2 has run once.
# It is gitignored, so it is a local cache and not a backup — but it is a perfectly good
# input for every later step, and re-staging over it is the only thing the skill is
# needed for here.
DS_SYNC_COMPLETE=0
if [ -f .ds-sync/package-build.mjs ] && [ -f .ds-sync/resync.mjs ] && [ -d .ds-sync/lib ]; then
  DS_SYNC_COMPLETE=1
fi

if [ ! -d "${DS_SKILL_DIR:-/nonexistent}" ]; then
  if [ "$DS_SYNC_COMPLETE" = "1" ]; then
    echo "WARNING: the design-sync skill is not on disk, so step 2 is skipped." >&2
    echo "  .ds-sync/ already holds a complete converter and every later step uses it." >&2
    echo "  It is GITIGNORED: it is the only copy on this machine right now. Do not run" >&2
    echo "  'git clean -fdx' or delete .ds-sync/ until the skill is back on disk." >&2
    echo "  To restore the skill: invoke /design-sync in a Claude Code session, which" >&2
    echo "  re-extracts it, then re-run this script." >&2
    echo >&2
    SKIP_STAGING=1
  else
    echo "ERROR: the design-sync skill was not found and .ds-sync/ is incomplete." >&2
    echo "  Searched: /private/tmp/claude-501, /tmp/claude-\$(id -u), \$HOME/.claude" >&2
    echo "  Bundled skills are extracted on demand into temp storage and get evicted," >&2
    echo "  so an absent path is normal, not a broken install. Invoke /design-sync in a" >&2
    echo "  Claude Code session to re-extract it, then re-run this script." >&2
    echo "  If you know the path: DS_SKILL_DIR=<path> bash $0" >&2
    exit 1
  fi
else
  SKIP_STAGING=0
  echo "design-sync skill: $DS_SKILL_DIR"
fi

echo "== 1/6: self-link (package-build.mjs resolves the DS at <node-modules>/<pkg>; in the package's own repo that path doesn't exist on its own) =="
ln -sfn .. node_modules/safe-unfollow

echo "== 2/6: staging the skill's converter into .ds-sync/ =="
if [ "$SKIP_STAGING" = "1" ]; then
  echo "   skipped — using the copy already in .ds-sync/ (see warning above)"
else
mkdir -p .ds-sync
cp -r \
  "$DS_SKILL_DIR"/package-build.mjs \
  "$DS_SKILL_DIR"/package-validate.mjs \
  "$DS_SKILL_DIR"/package-capture.mjs \
  "$DS_SKILL_DIR"/resync.mjs \
  "$DS_SKILL_DIR"/lib \
  "$DS_SKILL_DIR"/storybook \
  .ds-sync/
fi

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
