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

# Emit context in the dialect the current host actually consumes.
# Claude Code and Codex read the nested hookSpecificOutput form; Cursor reads a
# flat additional_context; Copilot reads a flat additionalContext. Claude Code
# tolerates raw stdout on SessionStart but DROPS it on SubagentStart, so the
# nested form is used everywhere for consistency.
#
# Pass a third argument to force a host when detection cannot infer it.
praxis_emit() {
  local event="$1" context="$2" host="${3:-}"

  if [ -z "$host" ]; then
    if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then host=cursor
    elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then host=claude
    # Codex exposes PLUGIN_ROOT/PLUGIN_DATA and no CLAUDE_PLUGIN_ROOT. Without
    # this branch it fell through to the flat Copilot shape and Codex dropped
    # the context silently.
    elif [ -n "${PLUGIN_ROOT:-}${PLUGIN_DATA:-}" ]; then host=codex
    else host=copilot
    fi
  fi

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
