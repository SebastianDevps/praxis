#!/usr/bin/env bash
# worktree.sh — the builder's checkout (specs/factory-cycle, design.md appendix).
#
#   scripts/worktree.sh <change> [base]
#
# Creates `.praxis/worktrees/<change>` on branch `praxis/<change>`, branched from <base> — the
# current branch when none is given — with `git worktree add`. The orchestrator runs it before
# dispatching the builder and passes the printed path as the builder's cwd; the builder commits
# there, on its own branch, and the main checkout never sees a half-built change in its tree.
#
# Idempotent, in three states, because the orchestrator may run it on resume and the person
# may run it by hand. Every state re-seeds `.praxis/` and the spec (below) and touches nothing
# else in the checkout:
#
#   worktree registered at the path   → print the path (the builder's uncommitted work is in
#                                       there, untouched); a registration whose directory is
#                                       gone is pruned and re-added
#   branch exists, no worktree        → add the worktree on the existing branch (a removed
#                                       checkout, a branch pushed earlier); no `-b`. A branch
#                                       checked out at some OTHER path is a refusal: git will
#                                       not check a branch out twice, and guessing which copy
#                                       the builder meant is not this script's call
#   neither                           → `git worktree add -b praxis/<change> <path> <base>`
#
# The base is recorded on the branch (`git config branch.praxis/<c>.praxisBase`) when the
# branch is created, so later runs — and approve.sh naming the PR's base — read the branch the
# change really started from, not whatever the main checkout is on today.
#
# `praxis_ensure_praxis_dir` runs first so `.praxis/.gitignore` carries `worktrees/`: a nested
# checkout that is not ignored shows up in the main tree's status as untracked, and the ship
# gate's `git push` would be the least of the confusion.
#
# Prints what it did, then `base: <branch>` (for the ledger's `base:` field), then the
# worktree's absolute, physical path on the LAST line. Exit 1 on refusal (not a repo, no
# commit to branch from, a non-worktree directory in the way, the branch checked out
# elsewhere), 2 on usage. Zero dependencies beyond bash + git.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/../hooks/lib.sh"

change="${1:-}"
base="${2:-}"
[ -n "$change" ] || { echo "usage: worktree.sh <change> [base]   (base: the branch to start from; default the current one)" >&2; exit 2; }
case "$change" in */*|*..*|_templates|.*) echo "error: '${change}' is not a change name" >&2; exit 2 ;; esac

root="$(praxis_project_root "$PWD")"
git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "error: ${root} is not a git repository" >&2; exit 1; }
git -C "$root" rev-parse --verify --quiet HEAD >/dev/null || { echo "error: ${root} has no commit yet — nothing to branch praxis/${change} from" >&2; exit 1; }

praxis_ensure_praxis_dir "$root" || { echo "error: cannot create ${root}/.praxis" >&2; exit 1; }

branch="praxis/${change}"
path="${root}/.praxis/worktrees/${change}"

# The floor runs inside the worktree too, and there `git rev-parse --show-toplevel` is the
# worktree: `hooks/pre-tool-use` looks for `.praxis/active-change`, the spec file and the
# approval marker under the builder's cwd. `.praxis/` is gitignored and an unshipped spec is
# not on the branch, so neither arrives with the checkout. Seed them — copies, refreshed on
# every run, overwriting. Never the ledger or `review/`: one `implementation.md`, in the main
# checkout, written by the orchestrator; the builder has no business with either.
seed_worktree() {
  local wt="$1" spec
  praxis_ensure_praxis_dir "$wt" || { echo "error: cannot create ${wt}/.praxis" >&2; exit 1; }
  printf '%s\n' "$change" > "${wt}/.praxis/active-change"
  if praxis_approved "$root" "$change"; then
    mkdir -p "${wt}/.praxis/approved"
    cp "$(praxis_approved_marker "$root" "$change")" "$(praxis_approved_marker "$wt" "$change")"
  fi
  spec="$(praxis_spec_file "$root" "$change")"
  if [ -n "$spec" ]; then
    mkdir -p "${wt}/specs/${change}"
    cp "${root}/${spec}" "${wt}/${spec}"
  fi
}

# The branch's recorded base: read it; when unset and a base was given, record it.
base_key="branch.${branch}.praxisBase"
recorded_base() {
  local b; b="$(git -C "$root" config --get "$base_key" 2>/dev/null || true)"
  if [ -z "$b" ] && [ -n "$base" ]; then git -C "$root" config "$base_key" "$base"; b="$base"; fi
  printf '%s' "${b:-unknown}"
}

# Where the branch is checked out, per `git worktree list`; nothing when it is not.
branch_checkout() {
  git -C "$root" worktree list --porcelain \
    | awk -v B="branch refs/heads/${branch}" '/^worktree / { p = substr($0, 10) } $0 == B { print p; exit }'
}

if [ -d "$path" ]; then
  real="$(cd "$path" && pwd -P)"
  if git -C "$root" worktree list --porcelain | grep -qFx "worktree ${real}"; then
    seed_worktree "$real"
    printf 'worktree exists: %s on %s\nbase: %s\n%s\n' ".praxis/worktrees/${change}" "$branch" "$(recorded_base)" "$real"
    exit 0
  fi
  if [ -n "$(ls -A "$path" 2>/dev/null)" ]; then
    echo "error: ${path} exists and is not a worktree of this repository — move it away, or remove it, then rerun" >&2; exit 1
  fi
  rmdir "$path"
fi

mkdir -p "${root}/.praxis/worktrees"
if git -C "$root" show-ref --verify --quiet "refs/heads/${branch}"; then
  at="$(branch_checkout)"
  if [ -n "$at" ]; then
    if [ "$(praxis_canonical_path "$at")" = "$path" ]; then
      # Registered here, directory gone (deleted by hand, not `git worktree remove`): git still
      # counts the branch as checked out until the stale entry is pruned.
      git -C "$root" worktree prune
    else
      echo "error: ${branch} is already checked out at ${at} — git will not check a branch out twice. Work there, or \`git worktree remove ${at}\` first" >&2; exit 1
    fi
  fi
  git -C "$root" worktree add --quiet "$path" "$branch"
  printf 'worktree added: %s on existing branch %s\n' ".praxis/worktrees/${change}" "$branch"
else
  [ -n "$base" ] || base="$(git -C "$root" rev-parse --abbrev-ref HEAD)"
  git -C "$root" worktree add --quiet -b "$branch" "$path" "$base"
  git -C "$root" config "$base_key" "$base"
  printf 'worktree created: %s on new branch %s from %s\n' ".praxis/worktrees/${change}" "$branch" "$base"
fi
seed_worktree "$path"
printf 'base: %s\n' "$(recorded_base)"
(cd "$path" && pwd -P)
