#!/usr/bin/env bash
# init.sh — project scaffold for the spec-driven workflow (`/praxis:init`).
#
# Runs in the CURRENT directory (the user's project) and creates ONLY what is missing:
#
#   AGENTS.md                     project instructions, host-agnostic
#   CLAUDE.md -> AGENTS.md
#   agents/README.md              index of rules by section
#   agents/rules/_sections.md     section order + impact
#   agents/rules/_template.md     rule frontmatter, incorrect -> correct example
#   agents/knowledge-base.md      domain facts, not code rules
#   agents/commands.md            build / test / dev commands
#   specs/_templates/             copied from the plugin's specs/_templates/
#   .claude/rules -> ../agents/rules
#
# Idempotent: prints `create <path>` or `keep <path>` per entry; a second run prints only
# `keep` lines and changes nothing. Never overwrites a file the user already has.
# Symlinks fall back to a copy where the filesystem refuses them (Windows), and say so.
# Zero dependencies beyond bash + coreutils. Design: specs/spec-driven-workflow/design.md §5.

set -euo pipefail

# Resolve the plugin root from this script's own location, the same way hooks/lib.sh does
# (never a variable named PLUGIN_ROOT — that is Codex's host signal).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRAXIS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASSETS="${SCRIPT_DIR}/init-assets"
TEMPLATES="${PRAXIS_ROOT}/specs/_templates"

[ -d "$ASSETS" ]    || { echo "error: missing ${ASSETS}" >&2; exit 2; }
[ -d "$TEMPLATES" ] || { echo "error: missing ${TEMPLATES}" >&2; exit 2; }

say() { printf '%s %s\n' "$1" "$2"; }

# exists <path> — true for a file, a directory, or a symlink (even a dangling one)
exists() { [ -e "$1" ] || [ -L "$1" ]; }

# copy_if_missing <src-file> <dst-path>
copy_if_missing() {
  local src="$1" dst="$2"
  if exists "$dst"; then say keep "$dst"; return; fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  say create "$dst"
}

# link_if_missing <target> <link-path> — target is relative to the link's directory.
# Falls back to a copy when the filesystem cannot create symlinks, and prints the difference.
link_if_missing() {
  local target="$1" link="$2"
  if exists "$link"; then say keep "$link"; return; fi
  mkdir -p "$(dirname "$link")"
  if ln -s "$target" "$link" 2>/dev/null; then
    say create "$link -> $target"
  else
    cp -R "$(dirname "$link")/$target" "$link"
    say create "$link (copy of $target — symlinks unavailable here; edit $target and re-copy, the two will not track each other)"
  fi
}

# copy_tree_if_missing <src-dir> <dst-dir> — files and symlinks entry by entry, so a user
# file inside an existing tree is kept while the missing siblings are still created.
copy_tree_if_missing() {
  local src="$1" dst="$2" entry name
  shopt -s nullglob
  for entry in "$src"/* "$src"/.[!.]*; do
    name="$(basename "$entry")"
    if [ -L "$entry" ]; then
      link_if_missing "$(readlink "$entry")" "$dst/$name"
    elif [ -d "$entry" ]; then
      mkdir -p "$dst/$name"
      copy_tree_if_missing "$entry" "$dst/$name"
    else
      copy_if_missing "$entry" "$dst/$name"
    fi
  done
}

# ---- project instructions ----------------------------------------------------------------
copy_if_missing "${ASSETS}/AGENTS.md" "AGENTS.md"
link_if_missing "AGENTS.md" "CLAUDE.md"

# ---- agents/ : curated project knowledge --------------------------------------------------
copy_if_missing "${ASSETS}/agents/README.md"            "agents/README.md"
copy_if_missing "${ASSETS}/agents/rules/_sections.md"   "agents/rules/_sections.md"
copy_if_missing "${ASSETS}/agents/rules/_template.md"   "agents/rules/_template.md"
copy_if_missing "${ASSETS}/agents/knowledge-base.md"    "agents/knowledge-base.md"
copy_if_missing "${ASSETS}/agents/commands.md"          "agents/commands.md"

# ---- specs/_templates : the shape of a change ---------------------------------------------
mkdir -p "specs/_templates"
copy_tree_if_missing "$TEMPLATES" "specs/_templates"

# ---- .claude/rules : expose agents/rules to Claude Code natively --------------------------
if [ -d ".claude/rules" ] && [ ! -L ".claude/rules" ]; then
  say keep ".claude/rules (existing directory, left as is — to keep one source, move its files into agents/rules/ and replace it with a symlink)"
else
  link_if_missing "../agents/rules" ".claude/rules"
fi
