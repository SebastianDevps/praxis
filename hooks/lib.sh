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

# The project's documented standard, as Level-1 pointers for the reviewer.
#
#   praxis_project_rules <project root>
#
# One line per `agents/rules/*.md` — path plus its title — and one for
# `CONSTRAINTS.md` when present. Never the bodies: the same doctrine as
# praxis_agent_skills (docs/context-delivery.md); the reviewer reads the rule it
# needs. Files starting with `_` are the scaffold's own (`_sections.md`,
# `_template.md`), not rules. Empty output means the project documents nothing,
# which is a valid state, not an error: the Standards axis then runs on the
# Fowler floor alone and says so.
#
# ADR-002 (specs/mattpocock-imports): these reach `reviewer` and no builder. The
# caller decides who; this function only resolves what.
praxis_project_rules() {
  local root="$1" f title out=""
  [ -n "$root" ] && [ -d "$root" ] || return 0
  for f in "${root}"/agents/rules/*.md; do
    [ -f "$f" ] || continue
    case "${f##*/}" in _*) continue ;; esac
    title=$(praxis_doc_title "$f")
    out="${out}- \`agents/rules/${f##*/}\`${title:+ — ${title}}
"
  done
  if [ -f "${root}/CONSTRAINTS.md" ]; then
    title=$(praxis_doc_title "${root}/CONSTRAINTS.md")
    out="${out}- \`CONSTRAINTS.md\`${title:+ — ${title}}
"
  fi
  printf '%s' "$out"
}

# A document's title line: `title:` in its frontmatter, else its first `#`
# heading, else nothing. Quotes around a frontmatter value are stripped.
praxis_doc_title() {
  [ -f "$1" ] || return 0
  awk '
    NR == 1 && /^---[ \t]*$/ { fm = 1; next }
    fm && /^---[ \t]*$/       { fm = 0; next }
    fm && /^title:/ { sub(/^title:[ \t]*/, ""); gsub(/^["'"'"']|["'"'"']$/, ""); print; exit }
    !fm && /^#[ \t]+/ { sub(/^#[ \t]+/, ""); print; exit }
  ' "$1"
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
    .praxis/approved/*|.praxis/needs-human/*|.praxis/worktrees/*) return 1 ;;
    specs/*|.praxis/*|agents/*|AGENTS.md|CLAUDE.md|PROGRESS.md|CONSTRAINTS.md) return 0 ;;
  esac
  return 1
}

# The builder's checkout is a linked worktree under `<root>/.praxis/worktrees/<name>/`
# (scripts/worktree.sh), while the host's project dir stays on the main checkout. A path in
# there belongs to that checkout — its own `.praxis/`, `specs/` and `src/` — not to the main
# one's session state. Prints the worktree root when <rel> lies inside one, else nothing.
#   praxis_worktree_root <root> <rel path>
praxis_worktree_root() {
  local name
  case "$2" in
    .praxis/worktrees/*/*)
      name="${2#.praxis/worktrees/}"; name="${name%%/*}"
      case "$name" in ""|.|..) return 0 ;; esac
      printf '%s/.praxis/worktrees/%s' "$1" "$name" ;;
  esac
  return 0
}

# A shell command as the shell would read it: one segment per line, split on `&&`, `||`,
# `;`, `|`, `&` and newlines; argv tokens separated by \034, quotes removed (single, and
# double with `\"`). This is what lets the ship gate see `git -C <dir> push …` and `cd <dir>`
# as commands rather than find `git push` as a substring — `echo "git push"` is one token of
# an echo. Variables and substitutions are not expanded: a directory the shell would compute
# is one git cannot be asked about, and a gate reading it fails open (Bash-path gap class).
praxis_shell_segments() {
  printf '%s\n' "$1" | awk '
    BEGIN { US = sprintf("%c", 28) }
    function flush_tok() { if (tok != "") { seg = (seg == "" ? tok : seg US tok); tok = "" } }
    function flush_seg() { flush_tok(); if (seg != "") print seg; seg = "" }
    {
      s = $0; n = length(s); i = 1
      while (i <= n) {
        c = substr(s, i, 1)
        if (c == "\047") {
          j = index(substr(s, i + 1), "\047")
          if (j == 0) { tok = tok substr(s, i + 1); i = n + 1 } else { tok = tok substr(s, i + 1, j - 1); i += j + 1 }
          continue
        }
        if (c == "\"") {
          i++
          while (i <= n) {
            c = substr(s, i, 1)
            if (c == "\\" && i < n) { tok = tok substr(s, i + 1, 1); i += 2; continue }
            if (c == "\"") { i++; break }
            tok = tok c; i++
          }
          continue
        }
        if (c == " " || c == "\t") { flush_tok(); i++; continue }
        if (c == ";") { flush_seg(); i++; continue }
        if (c == "&" || c == "|") { flush_seg(); i += (substr(s, i + 1, 1) == c) ? 2 : 1; continue }
        tok = tok c; i++
      }
      flush_seg()
    }'
}

# The approval marker for a change: `.praxis/approved/<change>`, an empty file whose
# existence is the record that a person approved the design (specs/hook-owned-approval).
praxis_approved_marker() { printf '%s/.praxis/approved/%s' "$1" "$2"; }
praxis_approved() { [ -n "${2:-}" ] && [ -f "$(praxis_approved_marker "$1" "$2")" ]; }

# The escalation marker: `.praxis/needs-human/<change>`, written by post-tool-use when
# `decision.md` records ESCALATE, removed when a later decision records APPROVE
# (specs/factory-cycle). Like the approval marker, never the model's to Edit/Write.
praxis_needs_human_marker() { printf '%s/.praxis/needs-human/%s' "$1" "$2"; }

# The .gitignore Praxis writes into `.praxis/`: `active-change`, `approved/`, `needs-human/`,
# `worktrees/` and `session-started` are per-machine session state, not the team's record —
# same rule as `sessions.jsonl` in the memory store.
PRAXIS_GITIGNORE=$'active-change\napproved/\nneeds-human/\nworktrees/\nsession-started\n'

# Create `.praxis/` on first use and, only then, its .gitignore. An existing file is the
# project's and is never rewritten — with one exception: a file byte-identical to a default
# an earlier Praxis wrote, which nobody has edited, gains the entries added since
# (`needs-human/`, `worktrees/`), appended after its own lines, so a `.praxis/` created before
# they existed learns them. The appended shape is itself recognised, so the upgrade is
# idempotent. One edited character and the file is the project's.
praxis_ensure_praxis_dir() {
  local dir="$1/.praxis" file="$1/.praxis/.gitignore" current
  [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null || return 1
  if [ ! -f "$file" ]; then
    printf '%s' "$PRAXIS_GITIGNORE" > "$file" 2>/dev/null || true
    return 0
  fi
  current="$(cat "$file" 2>/dev/null; printf x)"; current="${current%x}"
  case "$current" in
    $'active-change\napproved/\nsession-started\n'|$'active-change\napproved/\n'| \
    $'active-change\napproved/\nsession-started\nneeds-human/\nworktrees/\n'|$'active-change\napproved/\nneeds-human/\nworktrees/\n')
      praxis_ensure_ignored "$1" needs-human/
      praxis_ensure_ignored "$1" worktrees/ ;;
  esac
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

# Every one of those paths that lies inside <root>, relative to it, one per line.
# Spec-side and source-side alike; the caller sorts them.
#   praxis_project_targets <root> <cwd> <paths, newline-separated>
praxis_project_targets() {
  local root="$1" cwd="$2" p abs
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    p="${p//\\\//\/}"; p="${p//\\\\/\\}"          # undo JSON escaping of / and \
    abs="$(praxis_canonical_path "$p" "$cwd")" || continue
    case "$abs" in "$root"/*) printf '%s\n' "${abs#"$root"/}" ;; esac
  done <<EOF
$3
EOF
}

# The first source-side target among those paths, relative to <root>; nothing when
# every path is spec-side or outside the project.
#   praxis_source_target <root> <cwd> <paths, newline-separated>
praxis_source_target() {
  local rel
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    praxis_is_spec_side "$rel" && continue
    printf '%s' "$rel"; return 0
  done <<EOF
$(praxis_project_targets "$1" "$2" "$3")
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

# One frontmatter value from stdin, trailing comment stripped; empty when the key is missing.
# Scoped to the `---` block when the text opens with one. Text without a block is scanned
# whole, so a lens that wrote `verdict:` as its first body line is still read: the floor
# should stand on what a role recorded, not on where it put the dashes. Every hook that
# reads a verdict — barrier, ship gate, the main thread's SKIP write — goes through this one
# reader, so the file a hook accepts is the file the next hook reads the same way.
#   praxis_frontmatter_read <key>   (stdin)
praxis_frontmatter_read() {
  awk -v KEY="$1" '
    NR == 1            { fm = ($0 ~ /^---[ \t]*$/); if (fm) next }
    fm && /^---[ \t]*$/ { exit }
    index($0, KEY ":") == 1 {
      sub(/^[^:]*:[ \t]*/, ""); sub(/[ \t]*#.*$/, ""); sub(/[ \t]+$/, ""); print; exit
    }
  '
}

# The same, from a file; empty when the file is missing.
#   praxis_frontmatter_field <file> <key>
praxis_frontmatter_field() {
  [ -f "$1" ] || return 0
  praxis_frontmatter_read "$2" < "$1"
}

# The `stage:` value from a ledger's frontmatter.
praxis_ledger_stage() { praxis_frontmatter_field "$1" stage; }

# --- The cycle's files (specs/factory-cycle, design.md appendix) ---------------
#
# The limits of the cycle — the review barrier, the round cap, the ship gate, the
# escalation record — are held by hooks, so every input they decide on is a file under
# `specs/<change>/` and nothing in the conversation. These helpers are the only readers
# of those files; the hooks compose them and add the message.

# The file the floor keys on: `spec.md` (the cycle), else the legacy `design.md` (every
# change closed before factory-cycle), else nothing. Relative to the project root, so
# one string serves both the test and the message that names it.
praxis_spec_file() {
  local root="$1" change="${2:-}"
  [ -n "$change" ] || return 0
  if [ -f "${root}/specs/${change}/spec.md" ]; then printf 'specs/%s/spec.md' "$change"
  elif [ -f "${root}/specs/${change}/design.md" ]; then printf 'specs/%s/design.md' "$change"
  fi
}

# The change's ledger, absolute; empty when it does not exist. In a linked worktree — the
# builder's checkout from scripts/worktree.sh — the ledger is not seeded: one ledger, in the
# main checkout, the orchestrator's. So when <root> has none and is a linked worktree, the
# main checkout's is read; the floor still requires it, it only looks where the design put it.
# `git-common-dir` is `.git` in the main checkout and the main `.git` from a linked one, in
# either spelling; no git, no fallback.
#   praxis_ledger_path <root> <change>
praxis_ledger_path() {
  local root="$1" change="${2:-}" common main
  [ -n "$change" ] || return 0
  if [ -f "${root}/specs/${change}/implementation.md" ]; then
    printf '%s/specs/%s/implementation.md' "$root" "$change"; return 0
  fi
  common="$(git -C "$root" rev-parse --git-common-dir 2>/dev/null)" || return 0
  [ -n "$common" ] || return 0
  case "$common" in /*) ;; *) common="${root}/${common}" ;; esac
  main="$(cd "${common}/.." 2>/dev/null && pwd -P)" || return 0
  [ "$main" != "$root" ] || return 0
  [ -f "${main}/specs/${change}/implementation.md" ] && printf '%s/specs/%s/implementation.md' "$main" "$change"
  return 0
}

# A frontmatter field of the change's ledger: `round:`, `builder:`, `lenses:`, `stage:`.
praxis_ledger_field() {
  local file; file="$(praxis_ledger_path "$1" "${2:-}")"
  [ -n "$file" ] || return 0
  praxis_frontmatter_field "$file" "$3"
}

# The ledger's round as a number. Missing or malformed reads as 0: no review yet.
praxis_ledger_round() {
  local r; r="$(praxis_ledger_field "$1" "$2" round)"
  case "$r" in ''|*[!0-9]*) printf '0' ;; *) printf '%s' "$((r))" ;; esac
}

# `specs/<change>/review/round-N`, absolute.
praxis_round_dir() { printf '%s/specs/%s/review/round-%s' "$1" "$2" "$3"; }

# The lens names a round waits for, one per line: `round-N/lenses`, which the orchestrator
# writes before dispatching the lenses; else the ledger's `lenses:` field, split on commas.
# Blank lines are dropped and a name carrying `/` is not a lens.
#   praxis_round_lenses <root> <change> <round>
praxis_round_lenses() {
  local dir names; dir="$(praxis_round_dir "$1" "$2" "$3")"
  if [ -f "${dir}/lenses" ]; then names=$(cat "${dir}/lenses" 2>/dev/null)
  else names=$(praxis_ledger_field "$1" "$2" lenses | tr ',' '\n')
  fi
  printf '%s\n' "$names" | awk '{ gsub(/^[ \t\r]+|[ \t\r]+$/, "") } $0 != "" && $0 !~ /\// { print }'
}

# The lenses whose `<lens>.md` is not yet in the round, one per line. Empty means the
# barrier is open — or that the round names no lens at all; the caller tells them apart.
praxis_round_missing() {
  local dir name; dir="$(praxis_round_dir "$1" "$2" "$3")"
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    [ -f "${dir}/${name}.md" ] || printf '%s\n' "$name"
  done <<EOF
$(praxis_round_lenses "$1" "$2" "$3")
EOF
}

# Every lens of the round that did not record `verdict: PASS`, as `<lens>: <verdict>`,
# one per line — `missing` for a file not yet written, `no verdict` for one without the
# line. Empty means every lens passed, or the round names none.
praxis_round_not_pass() {
  local dir name verdict; dir="$(praxis_round_dir "$1" "$2" "$3")"
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    if [ ! -f "${dir}/${name}.md" ]; then printf '%s: missing\n' "$name"; continue; fi
    verdict="$(praxis_frontmatter_field "${dir}/${name}.md" verdict)"
    [ "$verdict" = PASS ] || printf '%s: %s\n' "$name" "${verdict:-no verdict}"
  done <<EOF
$(praxis_round_lenses "$1" "$2" "$3")
EOF
}

# True when the round names at least one lens and every one recorded `verdict: PASS`.
# SKIP and CHANGES are both "not PASS"; a round nobody reviewed is not a pass either.
praxis_round_all_pass() {
  [ -n "$(praxis_round_lenses "$1" "$2" "$3")" ] && [ -z "$(praxis_round_not_pass "$1" "$2" "$3")" ]
}

# The approver's verdict: the `verdict:` line of `specs/<change>/decision.md` —
# `APPROVE`, `ESCALATE` or `APPROVE (human)`; empty when the file is not written.
praxis_decision_verdict() {
  [ -n "${2:-}" ] || return 0
  praxis_frontmatter_field "$1/specs/$2/decision.md" verdict
}

# --- Content pass: tier-1 comment discipline ---------------------------------
#
# specs/comment-discipline, ADR-001/ADR-002. Praxis had never read what was being
# written — `praxis_edit_paths` above takes `file_path` and nothing else. These four
# helpers are the first content pass in the plugin, and everything about them is
# shaped by one rule: only lines this edit ADDS are inspected. A floor that denies
# because of a comment already in the person's file is worse than no floor.

# Every value of a string-valued JSON field, decoded, one per line.
#
# `praxis_json_string` above cannot do this and must not be used for it: its sed
# body is `"key"[[:space:]]*:[[:space:]]*"\([^"]*\)"`, which stops at the first
# `\"` inside the value — so `const s = "quoted";` truncates the file body at the
# opening quote of the literal — and its leading `.*` is greedy, so on MultiEdit it
# returns the LAST `new_string` rather than all of them. Both are fine for the short
# values it was written for (`tool_name`, `file_path`) and fatal for a file body.
# Tested: tests/hooks.test.mjs, "the content extractor survives a body that
# praxis_json_string truncates".
praxis_json_strings() {
  printf '%s' "$1" | awk -v KEY="$2" '
    # Escaped backslashes and escaped quotes are parked on two control characters
    # FIRST, in one linear gsub each. After that the closing quote of a value is
    # simply the next `"`, found by one index() — no per-escape rescan. The obvious
    # version (walk to each `"`, count the backslashes before it) is quadratic in the
    # size of the body: measured at 1.0s on a 190KB write, 0.10s here.
    BEGIN { S1 = sprintf("%c", 1); S2 = sprintf("%c", 2); BS = sprintf("%c", 92) }
    # Restoring a literal backslash is where portability bites twice. gsub is out:
    # awks disagree on how many backslashes a replacement needs, and this one doubled
    # them. split/join is out too: BWK awk 20200816 splits on a newline as well as on
    # the separator it was given, so a two-line value came back joined by backslashes.
    # index() walks the string with no interpretation at all, which is the only
    # behaviour all three agree on.
    function unpark(v,   i, out) {
      out = ""
      while ((i = index(v, S1)) > 0) { out = out substr(v, 1, i - 1) BS; v = substr(v, i + 1) }
      return out v
    }
    { P = P $0 "\n" }
    END {
      gsub(/\\\\/, S1, P)
      gsub(/\\"/, S2, P)
      key = "\"" KEY "\""; kl = length(key)
      while ((i = index(P, key)) > 0) {
        rest = substr(P, i + kl)
        if (match(rest, /^[ \t\r\n]*:[ \t\r\n]*"/)) {
          tail = substr(rest, RLENGTH + 1)
          q = index(tail, "\"")
          if (q > 0) {
            v = substr(tail, 1, q - 1)
            gsub(/\\n/, "\n", v)
            gsub(/\\t/, "\t", v)
            gsub(/\\r/, "", v)
            gsub(/\\b/, " ", v)
            gsub(/\\f/, " ", v)
            gsub(/\\u[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/, "?", v)
            gsub(/\\\//, "/", v)
            gsub(S2, "\"", v)
            print unpark(v)
            P = substr(tail, q + 1)
            continue
          }
        }
        P = rest
      }
    }
  '
}

# The lines an edit ADDS, one per line.
#
#   praxis_added_lines <payload> <tool_name>
#
# Write        every line of tool_input.content
# Edit         lines of new_string absent from old_string
# MultiEdit    the same, with every edits[] entry pooled: a line already present in
#              ANY old_string counts as pre-existing. Deliberately permissive —
#              constraint A pushes every ambiguity toward allow.
# apply_patch  the `+` lines of the Codex patch, which mark additions explicitly.
# Comparison is on the whitespace-trimmed line, so re-indenting an existing comment
# does not turn it into an added one.
praxis_added_lines() {
  case "$2" in
    Write)
      praxis_json_strings "$1" content
      ;;
    Edit|MultiEdit)
      { praxis_json_strings "$1" old_string; printf '\034\n'; praxis_json_strings "$1" new_string; } | awk '
        function trim(s) { sub(/^[ \t\r]+/, "", s); sub(/[ \t\r]+$/, "", s); return s }
        !split_seen && $0 == "\034" { split_seen = 1; next }
        !split_seen                 { old[trim($0)] = 1; next }
        !(trim($0) in old)          { print }
      '
      ;;
    apply_patch)
      praxis_json_strings "$1" command | awk '/^\+/ && !/^\+\+\+/ { print substr($0, 2) }'
      ;;
  esac
}

# Which comment syntax a path uses: hash | dash | semi | slash | skip.
#
# Keyed to the extension rather than to a union of every marker, because the union
# is where the false positives live: `--` is a comment in SQL and an underline in a
# numpy docstring, `#` is a comment in Python and a preprocessor directive in C.
# `skip` covers the mechanical carve-outs — generated trees, lockfiles, minified
# bundles — and prose formats, whose headings and horizontal rules are the shapes
# the banner detector looks for.
praxis_comment_group() {
  local p="$1" base ext
  base="${1##*/}"
  case "$base" in
    *.min.js|*.min.mjs|*.min.css) printf 'skip'; return 0 ;;
    package-lock.json|yarn.lock|pnpm-lock.yaml|Cargo.lock|poetry.lock|Gemfile.lock|composer.lock|go.sum|uv.lock|bun.lockb|*.lock)
      printf 'skip'; return 0 ;;
  esac
  case "/${p}/" in
    */node_modules/*|*/dist/*|*/build/*|*/vendor/*|*/.next/*|*/target/*|*/out/*|*/generated/*|*/__generated__/*)
      printf 'skip'; return 0 ;;
  esac
  ext=""
  case "$base" in *.*) ext="$(printf '%s' "${base##*.}" | tr 'A-Z' 'a-z')" ;; esac
  case "$ext" in
    md|markdown|mdx|txt|rst|adoc|json|jsonc|csv|tsv|svg|xml|html|htm|lock|snap|patch|diff) printf 'skip' ;;
    py|pyi|rb|sh|bash|zsh|fish|pl|pm|r|jl|nim|cr|ex|exs|yml|yaml|toml|tf|tfvars|cfg|ini|conf|mk|awk|ps1|cmake|gemspec|rake)
      printf 'hash' ;;
    sql|lua|hs|elm|ada|adb|ads|vhd|vhdl) printf 'dash' ;;
    lisp|clj|cljs|cljc|el|scm|ss|rkt|asm) printf 'semi' ;;
    "") case "$base" in
          Makefile|makefile|GNUmakefile|Dockerfile|Containerfile|Rakefile|Gemfile|Jenkinsfile|Procfile|Brewfile|.envrc) printf 'hash' ;;
          *) printf 'skip' ;;
        esac ;;
    *) printf 'slash' ;;
  esac
}

# Scan added lines (stdin) for the four tier-1 patterns. Prints `<kind>\t<line>` for
# the first offender and nothing at all when the lines are clean.
#
#   praxis_scan_comments <group>
#
# Only a line whose FIRST token is a comment marker is inspected. A trailing comment
# is a documented false negative: finding one means deciding whether `//` sits inside
# a string literal, and getting that wrong denies a line of correct code — the exact
# trade constraint B settles.
#
# Doc-comment markers (`///`, `//!`, `/**`, `/*!`, `#'`) are skipped entirely: ADR-005
# puts public and exported surfaces outside tier 1, and a rustdoc example is REQUIRED
# by C-EXAMPLE to contain compiling code that a commented-out-code detector would
# otherwise flag.
praxis_scan_comments() {
  awk -v GROUP="$1" '
    BEGIN { SQ = sprintf("%c", 39) }
    function trim(s) { sub(/^[ \t\r]+/, "", s); sub(/[ \t\r]+$/, "", s); return s }
    function hit(kind, line) { printf "%s\t%s\n", kind, line; exit }

    # A comment body that parses as code. Every shape is anchored to the WHOLE body:
    # commented-out code is a whole line of code, and the anchor is what keeps prose
    # that merely mentions `return` or `(` out of it.
    function code(c,   rhs) {
      if (c ~ /^[{}()\[\];,]+$/) return 1
      if (c ~ /^(if|for|while|switch|catch|foreach|elif|else if)[ \t]*\(/ && c ~ /\)/) return 1
      if (c ~ /^(return|throw|yield|raise|del|delete|assert)([ \t][^ \t].*)?;[ \t]*$/) return 1
      if (c ~ /^(return|break|continue|pass)[ \t]*;?[ \t]*$/) return 1
      if (c ~ /^(function|def|class|struct|interface|enum|const|let|var|public|private|protected|static|func|fn|type|impl|namespace)[ \t]+[A-Za-z_$]/ &&
          (c ~ /[;{][ \t]*$/ || c ~ /:[ \t]*$/ || c ~ /=/)) return 1
      if (c ~ /^import[ \t]+[^ \t]+[ \t]*;?[ \t]*$/) return 1
      if (c ~ /^import[ \t]*\{.*\}[ \t]*from[ \t]/) return 1
      if (c ~ /^import[ \t]+[A-Za-z_$][A-Za-z0-9_$]*[ \t]+from[ \t]/) return 1
      if (c ~ /^from[ \t]+[^ \t]+[ \t]+import[ \t]+/) return 1
      if (c ~ /^(use|require|include)[ \t]+[^ \t]+[ \t]*;[ \t]*$/) return 1
      if (c ~ /^[A-Za-z_$][A-Za-z0-9_$.]*\([^()]*\)[ \t]*;?[ \t]*$/) return 1
      if (c ~ /^<\/?[A-Za-z][^<>]*>[ \t]*$/) return 1
      # An assignment counts only when its right-hand side is code-shaped. Prose that
      # documents a field reads the same to the left of the `=`: `baseUrl = the API
      # root` must stay allowed, `total = 0` must not.
      if (c ~ /^[A-Za-z_$][A-Za-z0-9_$.\[\]]*[ \t]*(=|\+=|-=|\*=|\/=|:=|<-)[ \t]*[^ \t=]/ && c !~ /^[^=]*==/) {
        rhs = c
        sub(/^[A-Za-z_$][A-Za-z0-9_$.\[\]]*[ \t]*(=|\+=|-=|\*=|\/=|:=|<-)[ \t]*/, "", rhs)
        # Each shape is anchored to the END of the right-hand side too. Without that,
        # prose that opens with a literal reads as code: `n=1 per arm is a screening
        # pass` was the one false positive found by a sweep of the sources in this repo.
        if (rhs ~ /^[-+]?[0-9][0-9_.eExXa-fA-F]*[ \t]*;?[ \t]*$/) return 1
        if (rhs ~ /^["]/ || substr(rhs, 1, 1) == SQ || substr(rhs, 1, 1) == "`") return 1
        if (rhs ~ /^(true|false|null|nil|None|True|False|undefined)[ \t]*;?[ \t]*$/) return 1
        if (rhs ~ /[A-Za-z_$][A-Za-z0-9_$.]*\([^()]*\)[ \t]*;?[ \t]*$/) return 1
        if (rhs ~ /;[ \t]*$/) return 1
        if (rhs !~ /[ \t]/) return 1
      }
      return 0
    }

    {
      raw = $0
      if (length(raw) > 500) next            # a minified or data line, not prose
      t = trim(raw)
      if (t == "") next

      marker = ""
      if (GROUP == "hash") {
        if (substr(t, 1, 2) == "#!" || substr(t, 1, 2) == "#" SQ) next
        if (substr(t, 1, 1) == "#") { marker = "#"; body = substr(t, 2) }
      } else if (GROUP == "dash") {
        if (substr(t, 1, 3) == "---") next
        if (substr(t, 1, 2) == "--") { marker = "--"; body = substr(t, 3) }
      } else if (GROUP == "semi") {
        if (substr(t, 1, 1) == ";") { marker = ";"; body = substr(t, 2) }
      } else {
        if (substr(t, 1, 3) == "///" || substr(t, 1, 3) == "//!") next
        else if (substr(t, 1, 3) == "/**" || substr(t, 1, 3) == "/*!") next
        else if (substr(t, 1, 2) == "//")   { marker = "//";   body = substr(t, 3) }
        else if (substr(t, 1, 2) == "/*")   { marker = "/*";   body = substr(t, 3) }
        else if (substr(t, 1, 4) == "<!--") { marker = "<!--"; body = substr(t, 5) }
        else if (substr(t, 1, 2) == "* ")   { marker = "*";    body = substr(t, 2) }
      }
      if (marker == "") next

      b = trim(body)
      sub(/[ \t]*\*\/[ \t]*$/, "", b)
      sub(/[ \t]*-->[ \t]*$/, "", b)
      b = trim(b)
      if (b == "") next

      # Banner and divider comments: a body that is punctuation and nothing else.
      s = b; gsub(/[ \t]/, "", s)
      if (length(s) >= 4 && s ~ /^[-=*_~#+.<>\/\\|]+$/) hit("banner", raw)

      # A TODO with no owner and no tracker. The owner form and every shape of
      # tracker reference the craft cites are exemptions, not matches.
      if (b ~ /(^|[^A-Za-z0-9_])TODO[ \t]*[:(]/ &&
          b !~ /TODO[ \t]*\(/ &&
          b !~ /https?:\/\// &&
          b !~ /[A-Za-z0-9_-]+\.[A-Za-z][A-Za-z]+\// &&
          b !~ /#[0-9]/ &&
          b !~ /[A-Z][A-Z]+-[0-9]/) hit("todo", raw)

      # Chain-of-thought leakage: a comment that narrates the session rather than the
      # code. Four branches were written and then cut, each by a false positive found in
      # real prose rather than imagined — this is the detector the acceptance calls the
      # one that matters, and it was loosened four times rather than have a test edited.
      #
      #   `^(first|next|then|finally|lastly),`  cut: `# FIRST, in one linear gsub each`
      #                                         is a sentence continuing across two
      #                                         comment lines, in this very file.
      #   `^now[ \t]+we`                        cut: `// Now we hold the lock, so the
      #                                         read is safe` narrates the code.
      #   `^here.?s[ \t]+(the|what|how|why)`    cut: `// Here is why the offset is
      #                                         1-based` is the why-comment the craft
      #                                         exists to ask for.
      #   `i.?ve`, `we.?ve`, `i.?m`             cut: `// We have seen this fail on ARM`
      #                                         is engineering prose, and `i.?m` also
      #                                         matched a word opening with `im`.
      #
      # `step` additionally requires punctuation after its number, so `// Step 2 of the
      # handshake is the challenge` survives and `// Step 1: build the map` does not.
      lb = tolower(b)
      if (lb ~ /^step[ \t]*[0-9]+[ \t]*[:.)-]/ ||
          lb ~ /^now[ \t]+(let.?s|i.?ll)[ \t]/ ||
          lb ~ /^let.?s[ \t]/ ||
          lb ~ /^as[ \t]+requested([^a-z]|$)/ ||
          lb ~ /^as[ \t]+(you|we)[ \t]+(asked|requested|discussed|mentioned|wanted)/ ||
          lb ~ /^per[ \t]+your[ \t]+request/ ||
          lb ~ /^(i.?ll|we.?ll)[ \t]/ ||
          lb ~ /the user (asked|wants|requested|said)/ ||
          lb ~ /(your request|as we discussed|in the chat|per our conversation)/) hit("cot", raw)

      # Commented-out code. A `*` continuation line is exempt because `*p = 0;` is a
      # pointer store, not a comment; a tagged line is exempt so a TODO is judged once.
      if (marker == "*") next
      if (b ~ /^(TODO|FIXME|NOTE|HACK|XXX)([^A-Za-z]|$)/) next
      if (code(b)) hit("code", raw)
    }
  '
}
