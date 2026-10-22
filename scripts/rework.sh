#!/usr/bin/env bash
# rework.sh — the person sends a needs-human change back to the builder
# (`/praxis:rework <change> "<note>"`; specs/factory-cycle, design.md appendix).
#
# The approver recorded ESCALATE, `hooks/post-tool-use` wrote `.praxis/needs-human/<change>`,
# and the person has read the reviews and knows what the builder should do differently. This
# script turns that into files, so the next round starts clean and nothing about the old one
# is lost:
#
#   specs/<change>/review/rework-<k>/        k = 1, 2, … — one folder per rework
#     round-*/                               the archived rounds, lens files and lens lists
#     decision.md                            the approver's ESCALATE
#     note.md                                the person's note (frontmatter: rework, archived_round)
#   specs/<change>/implementation.md         round: 0 · stage: planned
#   .praxis/needs-human/<change>             removed
#   .praxis/ship/<change>                    removed — it belonged to the decision archived here
#
# Why the rounds move rather than stay: `hooks/pre-tool-use` reads `review/round-<round>/`
# for the barrier and the cap. A fresh cycle at round 1 must find an empty round-1, and a
# stale `decision.md: ESCALATE` would keep the ship gate shut on the new work. Why the ledger
# is written here: the orchestrator is its only writer in the model's hands, but `round:` is
# what the cap counts, and a counter the model resets is no cap. The person's script may reset
# it; the model may not (the hook denies nothing here — the gap is the same as Bash writes).
#
# Prints the archive, the ledger fields set, one `changes: <file>` line per archived lens at
# `verdict: CHANGES` (what the orchestrator hands the builder), and the note's absolute path on
# the LAST line. Exit 1 on refusal (no ledger), 2 on usage.
#
# The builder's worktree keeps its own `.praxis/` — a seeded mirror of the main checkout's
# markers (scripts/worktree.sh). This script changes only the main checkout; the orchestrator
# reruns `worktree.sh <change>` before resuming the builder, which re-seeds the mirror.
#
# The needs-human marker is not required: the person may send a change back at any point of the
# cycle — after round 1, before the approver ran — not only after an ESCALATE. When no marker
# existed the output says so in one line, and the round counter is reset all the same.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/../hooks/lib.sh"
. "${SCRIPT_DIR}/ledger-field.sh"
. "${SCRIPT_DIR}/lib-names.sh"

change="${1:-}"
note="${2:-}"
[ -n "$change" ] && [ -n "$note" ] || { echo 'usage: rework.sh <change> "<note>"   (what the builder should do differently)' >&2; exit 2; }
praxis_valid_change_name "$change" || { echo "error: '${change}' is not a change name ([A-Za-z0-9._-], no leading - or ., no ..)" >&2; exit 2; }

root="$(praxis_project_root "$PWD")"
ledger="${root}/specs/${change}/implementation.md"
[ -f "$ledger" ] || { echo "error: specs/${change}/implementation.md does not exist — nothing to rework" >&2; exit 1; }

review="${root}/specs/${change}/review"
k=0
for d in "${review}"/rework-*/; do
  [ -d "$d" ] || continue
  n="${d%/}"; n="${n##*rework-}"
  case "$n" in ''|*[!0-9]*) continue ;; esac
  [ "$n" -gt "$k" ] && k="$n"
done
k=$((k + 1))
archive="${review}/rework-${k}"
round_before="$(praxis_ledger_round "$root" "$change")"

mkdir -p "$archive"
archived=""
for d in "${review}"/round-*/; do
  [ -d "$d" ] || continue
  d="${d%/}"
  mv "$d" "${archive}/"
  archived="${archived} ${d##*/}"
done
if [ -f "${root}/specs/${change}/decision.md" ]; then
  mv "${root}/specs/${change}/decision.md" "${archive}/decision.md"
  archived="${archived} decision.md"
fi
printf -- '---\nrework: %s\narchived_round: %s\n---\n%s\n' "$k" "$round_before" "$note" > "${archive}/note.md"

praxis_set_frontmatter_field "$ledger" round 0
praxis_set_frontmatter_field "$ledger" stage planned

marker="$(praxis_needs_human_marker "$root" "$change")"
cleared="absent"
[ -f "$marker" ] && { rm -f "$marker"; cleared="removed"; }
ship="$(praxis_ship_marker "$root" "$change")"
shipped=""
[ -f "$ship" ] && { rm -f "$ship"; shipped=" · .praxis/ship/${change} removed"; }

printf 'rework %s of %s → specs/%s/review/rework-%s/ (archived:%s) · ledger round: 0, stage: planned · .praxis/needs-human/%s %s%s\n' \
  "$k" "$change" "$change" "$k" "${archived:- nothing}" "$change" "$cleared" "$shipped"
[ "$cleared" = removed ] || printf 'note: no .praxis/needs-human/%s existed — a rework before an ESCALATE is the person'"'"'s call; the round counter is reset all the same\n' "$change"
for f in "${archive}"/round-*/*.md; do
  [ -f "$f" ] || continue
  [ "$(praxis_frontmatter_field "$f" verdict)" = CHANGES ] && printf 'changes: %s\n' "$f"
done
printf '%s\n' "${archive}/note.md"
