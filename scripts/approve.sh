#!/usr/bin/env bash
# approve.sh — the person's explicit approval (`/praxis:approve <change>`). Two records, one
# command, both the model's to request and never to write:
#
# 1. The spec approval. Writes `.praxis/approved/<change>` in the CURRENT project: the marker
#    `hooks/pre-tool-use` gates source edits on in full mode (specs/hook-owned-approval,
#    ADR-001). Keyed on the spec file the floor keys on — `specs/<change>/spec.md`, or the
#    legacy `design.md` of a change closed before factory-cycle (praxis_spec_file). On Claude
#    Code the marker is normally written by `hooks/post-tool-use` when the person answers the
#    floor's `ask`; this path is for hosts without a prompt (Codex) and for unattended runs,
#    where a person — or CI — approves before the run starts.
#
# 2. The ship override (specs/factory-cycle, design.md appendix). When `.praxis/needs-human/<c>`
#    exists — the approver recorded ESCALATE and `hooks/post-tool-use` wrote the marker — the
#    person is deciding to ship anyway. The script writes `specs/<change>/decision.md` with
#    `verdict: APPROVE (human)` and the ship marker `.praxis/ship/<change>` — the two records
#    the ship gate reads, whatever the lenses said (design.md, Round-3 amendments: decision.md
#    alone is a file Bash can forge; the marker is written only by a hook or by this script) —
#    removes the needs-human marker, sets `stage: implemented` in the ledger (the appendix
#    names this script as a ledger writer; the person runs it) so the next step is ship, and
#    prints the two ship commands for the orchestrator to run. It does not run them: push and
#    PR are the orchestrator's, behind the gate, and `stage: shipped` is the orchestrator's
#    once the PR URL exists. The needs-human marker, and ONLY that marker, triggers this: a
#    ledger `stage: needs-human` is a field the model writes, and a model-written field
#    unlocks nothing (ADR-005).
#
# Refuses a change with neither spec file: there is nothing to approve, and a marker without a
# spec would let the floor through on a change that never had one.
#
# Typed by a person. The model receiving a deny is told to stop and wait for this; running
# it on the model's own initiative is the bypass the marker exists to remove, and there is
# no mechanical way to tell the two apart (documented gap, same class as Bash writes).
#
# Zero dependencies beyond bash + coreutils (+ git to name the PR's base). Exit 1 on refusal,
# 2 on usage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/../hooks/lib.sh"
. "${SCRIPT_DIR}/ledger-field.sh"
. "${SCRIPT_DIR}/lib-names.sh"

change="${1:-}"
[ -n "$change" ] || { echo "usage: approve.sh <change>   (a folder under specs/)" >&2; exit 2; }
praxis_valid_change_name "$change" || { echo "error: '${change}' is not a change name ([A-Za-z0-9._-], no leading - or ., no ..)" >&2; exit 2; }

root="$(praxis_project_root "$PWD")"
spec="$(praxis_spec_file "$root" "$change")"
[ -n "$spec" ] || { echo "error: specs/${change}/spec.md does not exist (nor the legacy design.md) — nothing to approve" >&2; exit 1; }
marker="$(praxis_needs_human_marker "$root" "$change")"

# The PR's base: what worktree.sh recorded on the branch when it created it, else the ledger's
# `base:`, else the branch the main checkout is on, else main.
pr_base() {
  local b
  b="$(git -C "$root" config --get "branch.praxis/${change}.praxisBase" 2>/dev/null || true)"
  [ -n "$b" ] || b="$(praxis_ledger_field "$root" "$change" base)"
  [ -n "$b" ] || b="$(git -C "$root" symbolic-ref --short -q HEAD 2>/dev/null || true)"
  printf '%s' "${b:-main}"
}

# The PR's title: the first non-empty line under the spec's `## Goal`, its list marker dropped.
spec_goal() {
  awk '
    /^## Goal[ \t]*$/ { want = 1; next }
    want && /^## /    { exit }
    want && NF        { sub(/^[ \t]*[-*][ \t]+/, ""); sub(/[ \t]+$/, ""); print; exit }
  ' "${root}/${spec}"
}

# On the ship override the base is validated BEFORE anything is written — the spec approval
# included: a bad value in the branch config or the ledger is a refusal, not a decision
# followed by a command nobody should paste.
if [ -f "$marker" ]; then
  base="$(pr_base)"
  praxis_valid_ref_name "$base" || { echo "error: PR base '${base}' is not a branch name ([A-Za-z0-9._/-], no leading -, no .., no //) — checked branch.praxis/${change}.praxisBase, the ledger's base:, HEAD" >&2; exit 2; }
fi

praxis_ensure_praxis_dir "$root" || { echo "error: cannot create ${root}/.praxis" >&2; exit 1; }
mkdir -p "${root}/.praxis/approved"
: > "$(praxis_approved_marker "$root" "$change")"

[ -f "$marker" ] || { printf 'approved %s → .praxis/approved/%s (spec: %s)\n' "$change" "$change" "$spec"; exit 0; }

# --- The ship override ------------------------------------------------------------------------

round="$(praxis_ledger_round "$root" "$change")"
ledger="${root}/specs/${change}/implementation.md"
decision="${root}/specs/${change}/decision.md"
ship="$(praxis_ship_marker "$root" "$change")"
printf -- '---\nverdict: APPROVE (human)\nround: %s\n---\n## Checks run\n- none — human override\n## Reason\napproved by the person via /praxis:approve\n' \
  "$round" > "$decision"
mkdir -p "${ship%/*}"
: > "$ship"
rm -f "$marker"
[ -f "$ledger" ] && praxis_set_frontmatter_field "$ledger" stage implemented

title="$(spec_goal)"; [ -n "$title" ] || title="$change"
body="Spec: specs/${change}/${spec##*/} · Decision: specs/${change}/decision.md (APPROVE (human), round ${round})"

printf 'approved %s → specs/%s/decision.md (verdict: APPROVE (human), round %s); .praxis/ship/%s written; .praxis/needs-human/%s removed; ledger stage: implemented\n' \
  "$change" "$change" "$round" "$change" "$change"
# Every interpolated value single-quoted (praxis_sq), the Goal included: these lines are pasted.
printf 'ship:\n  git push -u origin %s\n  gh pr create --base %s --head %s --title %s --body %s\n' \
  "$(praxis_sq "praxis/${change}")" "$(praxis_sq "$base")" "$(praxis_sq "praxis/${change}")" "$(praxis_sq "$title")" "$(praxis_sq "$body")"
