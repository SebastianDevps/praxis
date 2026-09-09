#!/usr/bin/env bash
# approve.sh — the person's explicit approval of a design (`/praxis:approve <change>`).
#
# Writes `.praxis/approved/<change>` in the CURRENT project: the marker `hooks/pre-tool-use`
# gates source edits on in full and deep mode (specs/hook-owned-approval, ADR-001). On Claude
# Code the marker is normally written by `hooks/post-tool-use` when the person answers the
# floor's `ask`; this script is for hosts without a prompt (Codex) and for unattended runs,
# where a person — or CI — approves before the run starts.
#
# Refuses a change with no `specs/<change>/design.md`: there is nothing to approve, and a
# marker without a design would let the floor through on a change that never had one.
#
# Typed by a person. The model receiving a deny is told to stop and wait for this; running
# it on the model's own initiative is the bypass the marker exists to remove, and there is
# no mechanical way to tell the two apart (documented gap, same class as Bash writes).
#
# Zero dependencies beyond bash + coreutils. Prints one line; exit 1 on refusal, 2 on usage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/../hooks/lib.sh"

change="${1:-}"
[ -n "$change" ] || { echo "usage: approve.sh <change>   (a folder under specs/)" >&2; exit 2; }
case "$change" in */*|*..*|_templates|.*) echo "error: '${change}' is not a change name" >&2; exit 2 ;; esac

root="$(praxis_project_root "$PWD")"
design="${root}/specs/${change}/design.md"
[ -f "$design" ] || { echo "error: specs/${change}/design.md does not exist — nothing to approve" >&2; exit 1; }

praxis_ensure_praxis_dir "$root" || { echo "error: cannot create ${root}/.praxis" >&2; exit 1; }
mkdir -p "${root}/.praxis/approved"
: > "$(praxis_approved_marker "$root" "$change")"
printf 'approved %s → .praxis/approved/%s (design: specs/%s/design.md)\n' "$change" "$change" "$change"
