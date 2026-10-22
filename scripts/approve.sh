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
# 2. The ship override (specs/factory-cycle, design.md appendix). When the change is in
#    needs-human — `.praxis/needs-human/<change>` exists, or the ledger says
#    `stage: needs-human` — the approver recorded ESCALATE and the person is deciding to ship
#    anyway. The script writes `specs/<change>/decision.md` with `verdict: APPROVE (human)`,
#    which the ship gate accepts whatever the lenses said, removes the marker, and prints the
#    two ship commands for the orchestrator to run. It does not run them: push and PR are the
#    orchestrator's, behind the gate, and the ledger's `stage: shipped` is the orchestrator's
#    to set once the PR URL exists.
#
# Refuses a change with neither spec file: there is nothing to approve, and a marker without a
# spec would let the floor through on a change that never had one.
#
# Typed by a person. The model receiving a deny is told to stop and wait for this; running
# it on the model's own initiative is the bypass the marker exists to remove, and there is
# no mechanical way to tell the two apart (documented gap, same class as Bash writes).
#
# Zero dependencies beyond bash + coreutils. Exit 1 on refusal, 2 on usage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/../hooks/lib.sh"

change="${1:-}"
[ -n "$change" ] || { echo "usage: approve.sh <change>   (a folder under specs/)" >&2; exit 2; }
case "$change" in */*|*..*|_templates|.*) echo "error: '${change}' is not a change name" >&2; exit 2 ;; esac

root="$(praxis_project_root "$PWD")"
spec="$(praxis_spec_file "$root" "$change")"
[ -n "$spec" ] || { echo "error: specs/${change}/spec.md does not exist (nor the legacy design.md) — nothing to approve" >&2; exit 1; }

praxis_ensure_praxis_dir "$root" || { echo "error: cannot create ${root}/.praxis" >&2; exit 1; }
mkdir -p "${root}/.praxis/approved"
: > "$(praxis_approved_marker "$root" "$change")"

marker="$(praxis_needs_human_marker "$root" "$change")"
stage="$(praxis_ledger_field "$root" "$change" stage)"
if [ -f "$marker" ] || [ "$stage" = needs-human ]; then
  round="$(praxis_ledger_round "$root" "$change")"
  decision="${root}/specs/${change}/decision.md"
  printf -- '---\nverdict: APPROVE (human)\nround: %s\n---\n## Checks run\n- none — human override\n## Reason\napproved by the person via /praxis:approve\n' \
    "$round" > "$decision"
  rm -f "$marker"
  printf 'approved %s → specs/%s/decision.md (verdict: APPROVE (human), round %s); .praxis/needs-human/%s removed\n' \
    "$change" "$change" "$round" "$change"
  printf 'ship:\n  git push -u origin praxis/%s\n  gh pr create --head praxis/%s --fill\n' "$change" "$change"
  exit 0
fi

printf 'approved %s → .praxis/approved/%s (spec: %s)\n' "$change" "$change" "$spec"
