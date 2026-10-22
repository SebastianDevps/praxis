#!/usr/bin/env bash
# lib-names.sh — the one place a person's script validates a name it will print into a command
# or build a path from, and the one way it quotes a value for a shell line someone will paste.
#
# Source it, never execute it:  . "${SCRIPT_DIR}/lib-names.sh"
#
# approve.sh prints `git push` and `gh pr create` lines the orchestrator copies into a shell;
# worktree.sh hands `praxis/<change>` and <base> to git as arguments; rework.sh builds paths
# from <change>. A value that starts with `-` becomes an option, a `;` or `$(` becomes a second
# command, `..` leaves the folder. The security lens (specs/factory-cycle/review/round-1/
# security.md) confirmed the injection through approve.sh's unquoted output, so every such value
# passes one of the two checks below before anything is written, and is single-quoted when
# printed. One copy: a validator per script is how one of them drifts.

# A change name — one folder under specs/: [A-Za-z0-9._-], no leading `-` or `.`, no `..`,
# never `_templates`.
praxis_valid_change_name() {
  case "$1" in
    ''|-*|.*|*..*|_templates) return 1 ;;
    *[!A-Za-z0-9._-]*) return 1 ;;
  esac
  return 0
}

# A git ref a script will pass or print — a branch like `main` or `release/2`: [A-Za-z0-9._/-],
# no leading `-` (an option to git), no `..`, no `//`, no leading or trailing `/`.
praxis_valid_ref_name() {
  case "$1" in
    ''|-*|/*|*/|*..*|*//*) return 1 ;;
    *[!A-Za-z0-9._/-]*) return 1 ;;
  esac
  return 0
}

# Single-quote a value for a shell line: the only character a single-quoted string cannot hold
# is the quote itself, which becomes '\''.
praxis_sq() {
  local s="$1" q="'"
  s="${s//$q/$q\\$q$q}"
  printf '%s' "${q}${s}${q}"
}
