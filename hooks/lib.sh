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

# The compact operating contract, single source of truth.
#   praxis_contract orchestrator  -> full text
#   praxis_contract subagent      -> orchestrator-only block stripped
#
# One file, filtered per target. Two files would drift; a dispatched specialist
# must not be told to dispatch specialists of its own or to render Run Cards.
praxis_contract() {
  local root="$1" target="${2:-orchestrator}"
  local file="${root}/hooks/context/contract.md"
  [ -f "$file" ] || return 0
  if [ "$target" = "subagent" ]; then
    awk '/<!-- orchestrator-only -->/{skip=1} /<!-- \/orchestrator-only -->/{skip=0;next} !skip' "$file"
  else
    grep -v '^<!-- /\?orchestrator-only -->$' "$file"
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
