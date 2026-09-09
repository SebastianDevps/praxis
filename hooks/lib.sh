#!/usr/bin/env bash
# Shared helpers for every Praxis hook.
#
# One copy of the JSON escaping and host-dialect detection. Before this file
# each hook hand-rolled both, so a fix in one never reached the others — the
# exact drift class the plugin is meant to prevent.
#
# Source it, never execute it:  . "${SCRIPT_DIR}/lib.sh"

# Resolve the plugin root from the directory of the *sourcing* script.
# Callers assign this to PRAXIS_ROOT, never PLUGIN_ROOT: Codex exports
# PLUGIN_ROOT as its host signal, so a script-local of that name shadowed the
# signal and made every host look like Codex to praxis_emit.
praxis_root() {
  local script_dir="$1"
  (cd "${script_dir}/.." && pwd)
}

# Escape a string for embedding in a JSON string literal (single pass, no jq).
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

# The directory the user is working in, per host.
praxis_project_dir() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$PWD}}"
}

# Retrieval guarantee (Layer-1 memory): return the project's memory index as an
# already-escaped block, or nothing. Writing lessons an agent never reads back
# is the #1 documented failure mode of agent memory; this read path defeats it.
praxis_memory_block() {
  local index; index="$(praxis_project_dir)/.praxis/memory/index.md"
  [ -f "$index" ] || return 0
  local raw; raw=$(cat "$index" 2>/dev/null || printf '')
  [ -n "$raw" ] || return 0
  printf '%s' "\\n\\n---\\nThis project has accumulated Praxis memory — apply these learned lessons and skills (detail in .praxis/memory/):\\n\\n$(escape_for_json "$raw")"
}

# --- Intensity dial -----------------------------------------------------------
#
# Trivial-vs-substantial was decided by the model on every turn. That is the one
# call the person driving should own: a typo fix should not cost a Run Card, and
# an architectural change should not be judged trivial because the diff is small.
# Three levels, held in a file so the answer is the same every turn.

PRAXIS_DEFAULT_MODE=full

praxis_state_dir() {
  if [ -n "${PLUGIN_DATA:-}" ]; then printf '%s' "$PLUGIN_DATA"
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then printf '%s' "${HOME}/.claude"
  else printf '%s' "${HOME}/.praxis"
  fi
}

# An unreadable or unrecognized value is not an error worth surfacing mid-session:
# fall back to the default so a corrupt flag can never leave a session unprimed.
praxis_mode() {
  local raw
  raw=$(cat "$(praxis_state_dir)/.praxis-mode" 2>/dev/null | tr -d '[:space:]')
  case "$raw" in
    fast|full|deep) printf '%s' "$raw" ;;
    *) printf '%s' "${PRAXIS_DEFAULT_MODE}" ;;
  esac
}

praxis_set_mode() {
  local mode="$1" dir; dir="$(praxis_state_dir)"
  case "$mode" in fast|full|deep) ;; *) return 1 ;; esac
  mkdir -p "$dir" 2>/dev/null || return 1
  printf '%s' "$mode" > "${dir}/.praxis-mode" 2>/dev/null || return 1
}

# The compact operating contract, single source of truth.
#
#   praxis_contract <root> <target> <mode>
#
# One file, filtered by tag. A block wrapped in `<!-- only:a,b -->` survives when
# any of its tags is active; the active set is the target, the mode, and the
# composite `<target>-<mode>` for rules that need both. Two files would drift, and
# a dispatched specialist must not be told to dispatch specialists of its own.
praxis_contract() {
  local root="$1" target="${2:-orchestrator}" mode="${3:-$PRAXIS_DEFAULT_MODE}"
  local file="${root}/hooks/context/contract.md"
  [ -f "$file" ] || return 0
  awk -v active=",${target},${mode},${target}-${mode}," '
    /^<!-- only:/ {
      tags = $0
      sub(/^<!-- only:/, "", tags); sub(/[ \t]*-->[ \t]*$/, "", tags)
      keep = 0
      n = split(tags, t, ",")
      for (i = 1; i <= n; i++) { gsub(/[ \t]/, "", t[i]); if (index(active, "," t[i] ",")) keep = 1 }
      skip = !keep
      next
    }
    /^<!-- \/only -->[ \t]*$/ { skip = 0; next }
    !skip
  ' "$file"
}

# Opt-in trace, inert unless PRAXIS_HOOK_TRACE names a file. Existed because the
# hooks were only ever verified by direct execution: whether the host actually
# fires them, and consumes what they emit, needs a live session to answer.
praxis_trace() {
  [ -n "${PRAXIS_HOOK_TRACE:-}" ] || return 0
  printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:-}" >> "$PRAXIS_HOOK_TRACE" 2>/dev/null || true
}

# Which host is running this hook: cursor | codex | claude | copilot.
#
# Codex is tested BEFORE Claude: Codex exports PLUGIN_ROOT/PLUGIN_DATA and, per its
# hooks reference, CLAUDE_PLUGIN_ROOT "for compatibility" — so CLAUDE_PLUGIN_ROOT
# alone cannot tell the two apart, while PLUGIN_ROOT is Codex-only. Without the
# Codex branch at all, Codex fell through to the flat Copilot shape and dropped
# the context silently.
praxis_host() {
  if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then printf 'cursor'
  elif [ -n "${PLUGIN_ROOT:-}${PLUGIN_DATA:-}" ]; then printf 'codex'
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then printf 'claude'
  else printf 'copilot'
  fi
}

# Emit context in the dialect the current host actually consumes.
# Claude Code and Codex read the nested hookSpecificOutput form; Cursor reads a
# flat additional_context; Copilot reads a flat additionalContext. Claude Code
# tolerates raw stdout on SessionStart but DROPS it on SubagentStart, so the
# nested form is used everywhere for consistency.
#
# Pass a third argument to force a host when detection cannot infer it.
praxis_emit() {
  local event="$1" context="$2" host="${3:-}"
  [ -n "$host" ] || host="$(praxis_host)"

  case "$host" in
    cursor)        printf '{\n  "additional_context": "%s"\n}\n' "$context" ;;
    claude|codex)  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "%s",\n    "additionalContext": "%s"\n  }\n}\n' "$event" "$context" ;;
    *)             printf '{\n  "additionalContext": "%s"\n}\n' "$context" ;;
  esac
}

# Strip a leading `---` frontmatter block. Every resource carries one
# (validate-resources.mjs enforces it), so a file without one yields nothing —
# which is the correct outcome here: no frontmatter means not a Praxis resource.
praxis_strip_frontmatter() {
  awk 'body {print} /^---[ \t]*$/ {n++; if (n == 2) body = 1}' "$1"
}

# The craft names an agent declares under od.craft.requires, one per line.
# Keyed on `requires:` specifically so the sibling `skills:` list is not picked up.
praxis_agent_craft_names() {
  awk '
    NR == 1 && /^---[ \t]*$/ { fm = 1; next }
    fm && /^---[ \t]*$/       { exit }
    fm && /^[[:space:]]*requires:[[:space:]]*$/ { want = 1; next }
    want && /^[[:space:]]*-[[:space:]]+/ { sub(/^[[:space:]]*-[[:space:]]+/, ""); print; next }
    want { want = 0 }
  ' "$1"
}

# Resolve the crafts a dispatched agent requires into their concatenated bodies.
#
# This is what makes "always-on crafts" mechanical instead of aspirational: the
# frontmatter declared them all along, but nothing read it, so a dispatched
# specialist inherited the label and none of the discipline.
#
# Unknown agent, stock agent, or no declaration -> empty, and the subagent still
# receives the operating contract.
praxis_agent_crafts() {
  local root="$1" agent="${2##*:}"   # strip the plugin namespace: praxis:design -> design
  [ -n "$agent" ] || return 0
  # agent_type is host-supplied. Confine it to a bare filename so it can never
  # traverse out of agents/ — the file-exists check alone would stop today's
  # payloads, but only because no matching file happens to be there.
  
  case "$agent" in */*|*..*) return 0 ;; esac
  local file="${root}/agents/${agent}.md"
  [ -f "$file" ] || return 0

  local out="" name body
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    body="${root}/crafts/${name}/${name}.md"
    [ -f "$body" ] || continue
    out="${out}
## Craft — ${name}
$(praxis_strip_frontmatter "$body")
"
  done <<EOF
$(praxis_agent_craft_names "$file")
EOF
  printf '%s' "$out"
}

# The skills a dispatched agent declares, as Level-1 pointers: name + description,
# never the body. See docs/context-delivery.md — Anthropic's published Level-1 cost
# is ~100 tokens per skill against under 5k for a body, and measured here injecting
# bodies costs 4-7x to collapse two levels the host already separates.
#
# The value is not only the tokens. Unassisted, the model matches a prompt against
# all 34 skills; a specialist matches against the 1-5 its role declares, already
# filtered by domain. That narrowing is what the activation audit says was missing.
praxis_agent_skills() {
  local root="$1" agent="${2##*:}"
  [ -n "$agent" ] || return 0
  case "$agent" in */*|*..*) return 0 ;; esac
  local file="${root}/agents/${agent}.md"
  [ -f "$file" ] || return 0

  local names out="" skill desc
  names=$(awk '
    NR == 1 && /^---[ \t]*$/ { fm = 1; next }
    fm && /^---[ \t]*$/       { exit }
    fm && /^skills:[ \t]*$/   { want = 1; next }
    want && /^[[:space:]]*-[[:space:]]+/ { sub(/^[[:space:]]*-[[:space:]]+/, ""); print; next }
    want { want = 0 }
  ' "$file")

  while IFS= read -r skill; do
    [ -n "$skill" ] || continue
    case "$skill" in */*|*..*) continue ;; esac
    local sf="${root}/skills/${skill}/SKILL.md"
    [ -f "$sf" ] || continue
    # description may be a single line or a folded block; take it through to the
    # next top-level key so a wrapped description is not truncated mid-sentence.
    desc=$(awk '
      NR == 1 && /^---[ \t]*$/ { fm = 1; next }
      fm && /^---[ \t]*$/      { exit }
      fm && /^description:/    { sub(/^description:[ \t]*>?-?[ \t]*/, ""); if (length($0)) print; want = 1; next }
      want && /^[[:space:]]+[^[:space:]]/ { sub(/^[[:space:]]+/, " "); printf "%s", $0; next }
      want { exit }
    ' "$sf" | tr '\n' ' ' | sed 's/[[:space:]]\{1,\}/ /g; s/^ //; s/ $//')
    out="${out}- \`${skill}\` — ${desc}
"
  done <<EOF
$names
EOF
  printf '%s' "$out"
}

# --- Spec folders ------------------------------------------------------------
#
# The per-change record lives in the USER's repository: `specs/<change>/`, one
# folder per change, `implementation.md` as its ledger (specs/spec-driven-workflow,
# ADR-002). Every hook that reads or gates on it resolves paths through the
# helpers below, so "where is the ledger" has one answer.

# A string-valued JSON field, first occurrence, no jq. Enough for the flat
# host payloads every hook receives; a value containing an escaped quote is
# truncated at it rather than mis-parsed.
praxis_json_string() {
  printf '%s' "$1" \
    | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -1
}

# The project root: the git toplevel of the project dir, else the project dir.
# Physical path (`pwd -P`), so a target under /tmp compares equal to the same
# file under /private/tmp — macOS hands hooks both spellings.
praxis_project_root() {
  local dir="${1:-$(praxis_project_dir)}" top
  top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || top="$dir"
  (cd "$top" 2>/dev/null && pwd -P) || printf '%s' "$top"
}

# Collapse `.` and `..` lexically. Input must be absolute.
praxis_normalize_path() {
  local IFS=/ seg out=""
  for seg in $1; do
    case "$seg" in ""|.) ;; ..) out="${out%/*}" ;; *) out="${out}/${seg}" ;; esac
  done
  printf '%s' "${out:-/}"
}

# Canonical absolute path for a target that may not exist yet: the deepest
# existing ancestor is resolved physically, the remainder appended verbatim.
#   praxis_canonical_path <path> [<base for a relative path>]
praxis_canonical_path() {
  local p="$1" base="${2:-$PWD}" rest="" dir
  case "$p" in /*) ;; *) p="${base}/${p}" ;; esac
  p=$(praxis_normalize_path "$p")
  dir="$p"
  while [ ! -d "$dir" ]; do
    rest="${dir##*/}${rest:+/$rest}"
    dir="${dir%/*}"
    [ -n "$dir" ] || { dir=/; break; }
  done
  dir=$(cd "$dir" 2>/dev/null && pwd -P) || return 1
  if [ -z "$rest" ]; then printf '%s' "$dir"
  elif [ "$dir" = / ]; then printf '/%s' "$rest"
  else printf '%s/%s' "$dir" "$rest"
  fi
}

# Spec-side paths, relative to the project root. Writing here is how the
# agent CREATES the record, so the floor never stands in front of it.
# `.praxis/approved/` is the one exception: the approval record is written by
# the person (via the host's ask, or /praxis:approve), never by the model.
praxis_is_spec_side() {
  case "$1" in
    .praxis/approved/*) return 1 ;;
    specs/*|.praxis/*|agents/*|AGENTS.md|CLAUDE.md|PROGRESS.md|CONSTRAINTS.md) return 0 ;;
  esac
  return 1
}

# The approval marker for a change: `.praxis/approved/<change>`, an empty file whose
# existence is the record that a person approved the design (specs/hook-owned-approval).
praxis_approved_marker() { printf '%s/.praxis/approved/%s' "$1" "$2"; }
praxis_approved() { [ -n "${2:-}" ] && [ -f "$(praxis_approved_marker "$1" "$2")" ]; }

# Create `.praxis/` on first use and, only then, its .gitignore. `active-change`,
# `approved/` and `session-started` are per-machine session state, not the team's
# record — same rule as `sessions.jsonl` in the memory store. Written only when absent:
# a project that has edited this file keeps its edit.
praxis_ensure_praxis_dir() {
  local dir="$1/.praxis"
  [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null || return 1
  [ -f "${dir}/.gitignore" ] || printf 'active-change\napproved/\nsession-started\n' > "${dir}/.gitignore" 2>/dev/null || true
}

# Append one entry to `.praxis/.gitignore` when it is not already listed. For a
# project whose .gitignore predates an entry: the file's own lines are kept, one is added.
praxis_ensure_ignored() {
  local file="$1/.praxis/.gitignore"
  [ -f "$file" ] || return 0
  grep -qx -- "$2" "$file" 2>/dev/null || printf '%s\n' "$2" >> "$file" 2>/dev/null || true
}

# The session marker: `.praxis/session-started`, an empty file whose mtime is when this
# session began (specs/stop-session-scope). `session-start` writes it on `startup` and
# `clear`; `stop` counts a changed file only when it is newer than this.
praxis_session_marker() { printf '%s/.praxis/session-started' "$1"; }

# The file paths an edit tool call targets, one per line, from the host payload.
# Claude Code: tool_input.file_path (MultiEdit carries the same key). Codex apply_patch:
# every `*** Add/Update/Delete File:` header; JSON keeps the patch on one line, so a
# header ends at the escaped newline or the closing quote.
praxis_edit_paths() {
  local paths; paths="$(praxis_json_string "$1" file_path)"
  if [ -z "$paths" ]; then
    paths=$(printf '%s' "$1" \
      | grep -oE '\*\*\* (Add|Update|Delete) File: [^"\\]+' \
      | sed -E 's/^\*\*\* (Add|Update|Delete) File: //')
  fi
  printf '%s' "$paths"
}

# The first source-side target among those paths, relative to <root>; nothing when
# every path is spec-side or outside the project.
#   praxis_source_target <root> <cwd> <paths, newline-separated>
praxis_source_target() {
  local root="$1" cwd="$2" p abs rel
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    p="${p//\\\//\/}"; p="${p//\\\\/\\}"          # undo JSON escaping of / and \
    abs="$(praxis_canonical_path "$p" "$cwd")" || continue
    case "$abs" in "$root"/*) rel="${abs#"$root"/}" ;; *) continue ;; esac
    praxis_is_spec_side "$rel" && continue
    printf '%s' "$rel"; return 0
  done <<EOF
$3
EOF
  return 0
}

# Every per-change ledger under <root>/specs, one absolute path per line.
# `_templates` is the blank form, never a change. Empty output means the
# project has not adopted the folder model.
praxis_spec_ledgers() {
  local root="$1" f
  for f in "${root}"/specs/*/implementation.md; do
    [ -f "$f" ] || continue
    case "$f" in */specs/_templates/*) continue ;; esac
    printf '%s\n' "$f"
  done
}

# The change the session is working on: `.praxis/active-change` (one line,
# written when the spec folder is created), else the most recently modified
# ledger's folder, else empty. The named change need not exist yet — the floor
# uses the name to say which file to create.
praxis_active_change() {
  local root="$1" name="" f newest=""
  if [ -f "${root}/.praxis/active-change" ]; then
    name=$(head -n 1 "${root}/.praxis/active-change" 2>/dev/null | tr -d '[:space:]')
    case "$name" in */*|*..*|_templates) name="" ;; esac
  fi
  if [ -z "$name" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      if [ -z "$newest" ] || [ "$f" -nt "$newest" ]; then newest="$f"; fi
    done <<EOF
$(praxis_spec_ledgers "$root")
EOF
    if [ -n "$newest" ]; then name="${newest%/implementation.md}"; name="${name##*/}"; fi
  fi
  printf '%s' "$name"
}

# The `stage:` value from a ledger's frontmatter, trailing comment stripped.
# Empty when the file or the key is missing.
praxis_ledger_stage() {
  [ -f "$1" ] || return 0
  awk '
    NR == 1 && /^---[ \t]*$/ { fm = 1; next }
    fm && /^---[ \t]*$/       { exit }
    fm && /^stage:/ { sub(/^stage:[ \t]*/, ""); sub(/[ \t]*#.*$/, ""); sub(/[ \t]+$/, ""); print; exit }
  ' "$1"
}
