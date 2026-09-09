#!/usr/bin/env bash
# loop.sh — guarded autonomous build loop ("ralph") driver for Praxis.
#
# Re-invokes `claude -p` on a FRESH context each iteration. The loop's memory is the
# filesystem: the active change's ledger, specs/<change>/implementation.md (ADR-002;
# PROGRESS.md is only the index of changes) + the loop's own git commits. ALL stop-limits
# are enforced HERE, in bash, OUTSIDE the model — a runner safety bound on an opt-in
# process, never a gate on the user's interactive session.
#
# The iteration prompt has the seven-section shape of Matt Pocock's ralph prompts
# (ralph-workshop `plans/prompt.md` → total-typescript-monorepo `plans/backlog/prompt.md`
# → sandcastle `simple-loop/prompt.md`) with Praxis's ledger in place of a PRD or an
# issue list. The model talks back through three signals, each alone on its own line:
#
#   NO MORE TASKS   (or COMPLETE)   the ledger has no pending task      → exit 0
#   ABORT                           the task is blocked; stop the run   → exit 1
#   HANG ON A SECOND                the task was bigger than expected;
#                                   it was split and the smaller chunk
#                                   done — the loop simply continues
#
# Exit codes: 0 complete · 1 ABORT or claude error · 2 usage · 3 verifier tampered ·
# 4 a guardrail stopped the run without completion (iteration cap, wall-clock, cost,
# no progress). Each guardrail below is commented with WHY it exists.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Shared with the hooks so "where is the ledger" has one answer (praxis_active_change).
. "${SCRIPT_DIR}/../hooks/lib.sh"

# ---- defaults (every guardrail is a flag) -----------------------------------------------
TASK=""                       # one-line goal injected into each iteration prompt
LEDGER=""                     # durable progress file; resolved below unless --ledger is given
MAX_ITERATIONS=20             # WHY: hard ceiling — the iteration cap is the primary cost proxy
MAX_DURATION="2h"             # WHY: wall-clock kill-switch — catches a hung/runaway iteration
MAX_COST=""                   # WHY: optional cumulative USD cap (best-effort; see note below)
DONE_STREAK=1                 # WHY: NO MORE TASKS is a statement about the ledger, checkable there;
                              #      raise it only when the ledger itself is not trusted
NO_PROGRESS_LIMIT=2           # WHY: identical failure or zero diff N times = stuck, not converging
DONE_MARKER="NO MORE TASKS"   # completion signal; COMPLETE is always accepted as well
HISTORY=10                    # how many previous loop commits the prompt carries
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

# Loop commits carry this trailer so the next iteration can find them with `git log --grep`.
# A trailer, not a subject prefix: the subject stays in the repo's own commit convention.
LOOP_TRAILER="Praxis-Loop"

usage() {
  cat <<'EOF'
Usage: bash scripts/loop.sh --task "<goal>" [options]

  --task TEXT             One-line goal (required). Injected into every iteration prompt.
  --ledger PATH           Progress ledger file (default: specs/<active change>/implementation.md,
                          the change named in .praxis/active-change or the newest ledger;
                          PROGRESS.md when the repo has no spec folders).
  --max-iterations N      Hard iteration ceiling (default: 20).
  --max-duration DUR      Wall-clock cap, e.g. 30m, 2h (default: 2h).
  --max-cost USD          Cumulative cost cap, best-effort (default: unset — see notes).
  --done-streak N         Consecutive completion signals required to stop (default: 1).
  --no-progress-limit N   Consecutive no-progress iterations before halt (default: 2).
  --done-marker STR       Completion signal the agent emits (default: NO MORE TASKS;
                          COMPLETE is always accepted as well).
  --history N             Previous loop commits shown to each iteration (default: 10).
  -h, --help              Show this help.

Signals, each alone on its own line of the agent's output (a mention inside prose is not a signal):
  NO MORE TASKS / COMPLETE   nothing pending in the ledger → exit 0
  ABORT                      blocked → exit 1 after that iteration
  HANG ON A SECOND           task re-scoped to a smaller chunk → the loop continues

Exit codes:
  0  complete (NO MORE TASKS / COMPLETE confirmed)
  1  ABORT, or claude exited non-zero
  2  usage error
  3  verifier-integrity guard: a test file was modified this iteration
  4  a guardrail stopped the run without completion: iteration cap, wall-clock,
     cost cap, or no progress

Stop-limits are enforced in bash, OUTSIDE the model. Guardrails:
  hard iteration cap · wall-clock timeout · best-effort cost cap · no-progress detection
  · completion confirmation · verifier-integrity guard (halts if a test file is touched)
  · human checkpoint on stall (diagnostics written to the ledger, no thrashing).
EOF
}

# ---- arg parsing ------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)             TASK="${2:-}"; shift 2 ;;
    --ledger)           LEDGER="${2:-}"; shift 2 ;;
    --max-iterations)   MAX_ITERATIONS="${2:-}"; shift 2 ;;
    --max-duration)     MAX_DURATION="${2:-}"; shift 2 ;;
    --max-cost)         MAX_COST="${2:-}"; shift 2 ;;
    --done-streak)      DONE_STREAK="${2:-}"; shift 2 ;;
    --no-progress-limit) NO_PROGRESS_LIMIT="${2:-}"; shift 2 ;;
    --done-marker)      DONE_MARKER="${2:-}"; shift 2 ;;
    --history)          HISTORY="${2:-}"; shift 2 ;;
    -h|--help)          usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -n "$TASK" ]] || { echo "error: --task is required" >&2; usage; exit 2; }
command -v "$CLAUDE_BIN" >/dev/null 2>&1 || { echo "error: '$CLAUDE_BIN' not found on PATH" >&2; exit 2; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "error: not inside a git repo — the loop uses git as its progress signal" >&2; exit 2; }

# WHY: the ledger is per change. Same resolution as hooks/subagent-stop: the active change's
# implementation.md, else the flat PROGRESS.md a pre-folder repo still carries.
if [[ -z "$LEDGER" ]]; then
  project_root="$(praxis_project_root "$PWD")"
  active="$(praxis_active_change "$project_root")"
  if [[ -n "$active" ]]; then LEDGER="${project_root}/specs/${active}/implementation.md"
  else LEDGER="PROGRESS.md"
  fi
fi

# WHY: the ledger is the loop's only memory. No ledger => no loop. Seed one if absent.
if [[ ! -f "$LEDGER" ]]; then
  mkdir -p "$(dirname "$LEDGER")"
  printf '# Progress Ledger\n\nTask: %s\n\n- [ ] (define bite-sized, independently-testable tasks here)\n' \
    "$TASK" > "$LEDGER"
  echo "[loop] seeded ledger at $LEDGER — fill it with a real plan before relying on the loop"
fi

# ---- duration -> deadline (epoch seconds) -----------------------------------------------
parse_duration_secs() {
  local d="$1" n unit
  n="${d%[smh]}"; unit="${d#"$n"}"
  case "$unit" in
    s) echo "$n" ;;
    m) echo $(( n * 60 )) ;;
    h|"") echo $(( n * 3600 )) ;;   # bare number => hours
    *) echo "error: bad duration '$d' (use Ns, Nm, Nh)" >&2; exit 2 ;;
  esac
}
DEADLINE=$(( $(date +%s) + $(parse_duration_secs "$MAX_DURATION") ))

# ---- helpers ----------------------------------------------------------------------------
# WHY: a stable signature of the current failure state. Identical signature across iterations
# means we are stuck (not converging), not making different progress. HEAD is part of it:
# without it a clean tree hashes the same after every commit, and a loop that committed
# real work each iteration was halted as "no progress" on its second one.
failure_signature() {
  { git rev-parse HEAD 2>/dev/null; git diff --stat 2>/dev/null; git status --porcelain 2>/dev/null; } | shasum | awk '{print $1}'
}

# WHY: reward-hacking guard. Strong models delete/edit tests to force green. If this iteration
# touched any test file, the verifier is compromised — HALT and alert, never accept the iteration.
TEST_FILE_RE='(^|/)(test|tests|__tests__|spec)/|(\.|_|-)(test|spec)\.[a-z]+$|_test\.[a-z]+$'
touched_test_file() {
  git diff --name-only "$1" HEAD 2>/dev/null | grep -Eiq "$TEST_FILE_RE"
}

log_diag() { printf '\n<!-- loop %s: %s -->\n' "$(date -u +%FT%TZ)" "$1" >> "$LEDGER"; }

# WHY: a signal is a whole line, never a substring. Matt's afk-claude.sh matched
# `*ABORT*` anywhere in the result, so a model narrating "I will not ABORT this" ended
# the run. `grep -x` anchors both ends; surrounding whitespace is the only slack.
#   has_signal <output> <ERE of the accepted words>
has_signal() {
  printf '%s\n' "$1" | grep -qxE "[[:space:]]*($2)[[:space:]]*"
}

# Escape a literal signal word for use inside the ERE above.
ere_literal() { printf '%s' "$1" | sed 's/[][\.*^$+?(){}|]/\\&/g'; }

# The last N loop commits, so an iteration inherits its predecessors' decisions and
# blockers without inheriting their context window.
recent_loop_commits() {
  local out
  out="$(git log --grep="^${LOOP_TRAILER}:" -n "$HISTORY" --format='%h %ad%n%B---' --date=short 2>/dev/null || true)"
  printf '%s' "${out:-none yet}"
}

# The seven-section iteration prompt. Rebuilt every iteration because the commit history
# grows; the ledger is read by the model itself so its edits are never stale here.
build_prompt() {
  cat <<EOF
You are ONE iteration of an autonomous loop. Your context is fresh: nothing from earlier iterations survives except the files and the commits below. Goal: ${TASK}

# LEDGER

Read ${LEDGER} (task lines, phases and states: docs/task-model.md). It is the only source of what exists to do. Then review the previous loop commits, newest first, to learn what was done, what was decided, and what blocked:

$(recent_loop_commits)

# TASK BREAKDOWN

If the next pending task is larger than one iteration can finish and verify, split it in the ledger first. Make each task the smallest possible unit of work. Do not outrun the headlights: one small change per task.

# TASK SELECTION

Pick ONE task in \`state: pending\` (never one in \`blocked(user)\`). Priority order:

1. Critical bugfixes
2. Tracer bullets — a thin end-to-end slice through every layer, proving the approach before it is widened
3. Polish and quick wins
4. Refactors

If no task remains, emit the line
${DONE_MARKER}
and stop.

# EXPLORATION

Search the codebase before implementing: the feature may already exist, and the conventions it must match are in the files around it. Fill your context with what the task needs.

# EXECUTION

Complete the task. Real code: no placeholders, no stubs. Never modify or delete a test file to make it pass.

If something blocks completion (missing context, a failing test you cannot fix, an external dependency), emit the line
ABORT
and stop.

If the task turns out larger than expected (it needs a refactor first), emit the line
HANG ON A SECOND
then split it in the ledger and do only the smaller chunk this iteration.

# FEEDBACK LOOPS

Before committing, run the typecheck and the tests. Both must pass. A red gate is not committed: fix it, or emit ABORT.

# COMMIT

Make exactly one git commit. Its message carries: the task completed · key decisions · files changed · blockers or notes for the next iteration. Update the task's line in ${LEDGER} in the same commit. End the message with the trailer
${LOOP_TRAILER}: <task id>

# FINAL RULES

Work on a SINGLE task. Signals (${DONE_MARKER}, ABORT, HANG ON A SECOND) are read only when they stand alone on a line, nothing else on it.
EOF
}

# ---- the loop ---------------------------------------------------------------------------
done_streak=0
no_progress=0
prev_sig="$(failure_signature)"
prev_head="$(git rev-parse HEAD 2>/dev/null || echo none)"
total_cost="0"

COMPLETE_RE="$(ere_literal "$DONE_MARKER")|COMPLETE"

for (( iter=1; iter<=MAX_ITERATIONS; iter++ )); do
  # WHY: wall-clock cap — bound total runtime regardless of iteration count.
  if (( $(date +%s) >= DEADLINE )); then
    log_diag "STOP: wall-clock deadline reached (--max-duration ${MAX_DURATION})"
    echo "[loop] STOP: max duration reached"; exit 4
  fi

  echo "[loop] iteration ${iter}/${MAX_ITERATIONS}"
  iter_start_head="$(git rev-parse HEAD 2>/dev/null || echo none)"

  # Fresh context each iteration: a new `claude -p` invocation, fed the seven-section prompt.
  set +e
  OUTPUT="$("$CLAUDE_BIN" -p "$(build_prompt)" 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$OUTPUT"

  # WHY: human checkpoint — a crashed CLI shouldn't trigger blind retries that thrash.
  if (( rc != 0 )); then
    log_diag "STOP: claude exited ${rc} on iteration ${iter} — human checkpoint"
    echo "[loop] STOP: claude error (exit ${rc}); diagnostics in ${LEDGER}"; exit 1
  fi

  # WHY: verifier-integrity guard runs BEFORE accepting the iteration. If tests were touched,
  # every subsequent green is untrustworthy — halt immediately.
  if touched_test_file "$iter_start_head"; then
    log_diag "HALT: a test file was modified/deleted this iteration — reward-hacking guard tripped"
    echo "[loop] HALT: test file changed — verifier integrity compromised" >&2; exit 3
  fi

  # WHY: best-effort cost cap. The CLI does not expose a stable machine-readable cost on stdout,
  # so we parse a 'cost: $X' line IF present. If absent, we cannot enforce --max-cost and say so —
  # we do NOT fabricate a number. The iteration cap remains the reliable cost proxy.
  if [[ -n "$MAX_COST" ]]; then
    line_cost="$(printf '%s\n' "$OUTPUT" | grep -oiE 'cost:?[[:space:]]*\$?[0-9]+\.?[0-9]*' | tail -1 | grep -oE '[0-9]+\.?[0-9]*' || true)"
    if [[ -n "$line_cost" ]]; then
      total_cost="$(awk -v a="$total_cost" -v b="$line_cost" 'BEGIN{printf "%.4f", a+b}')"
      if awk -v t="$total_cost" -v m="$MAX_COST" 'BEGIN{exit !(t>=m)}'; then
        log_diag "STOP: cumulative cost ${total_cost} >= cap ${MAX_COST}"
        echo "[loop] STOP: cost cap reached (${total_cost} >= ${MAX_COST})"; exit 4
      fi
    else
      echo "[loop] NOTE: --max-cost set but no cost emitted by '$CLAUDE_BIN' this iteration; cannot enforce — relying on iteration/time caps" >&2
    fi
  fi

  # WHY: ABORT is the model saying it is blocked. Retrying a blocked task on a fresh context
  # repeats the block; hand it to a person, and say so with the exit code.
  if has_signal "$OUTPUT" 'ABORT'; then
    log_diag "ABORT: the agent reported itself blocked on iteration ${iter} — human checkpoint"
    echo "[loop] ABORT: agent blocked on iteration ${iter}; diagnostics in ${LEDGER}"; exit 1
  fi

  # WHY: HANG ON A SECOND is re-scoping, not stopping. The task was split and the smaller
  # chunk done; the next iteration picks up the rest from the ledger. Logged, never acted on.
  if has_signal "$OUTPUT" 'HANG ON A SECOND'; then
    echo "[loop] HANG ON A SECOND: task re-scoped on iteration ${iter}; continuing"
  fi

  # WHY: completion confirmation. The signal is a claim about the ledger (no pending task);
  # --done-streak asks for it N times when one sighting is not enough to trust.
  if has_signal "$OUTPUT" "$COMPLETE_RE"; then
    done_streak=$(( done_streak + 1 ))
    echo "[loop] completion signal seen (${done_streak}/${DONE_STREAK})"
  else
    done_streak=0
  fi
  if (( done_streak >= DONE_STREAK )); then
    log_diag "DONE: completion signal confirmed ${DONE_STREAK}x"
    echo "[loop] DONE: no more tasks — completion confirmed ${DONE_STREAK} time(s)"; exit 0
  fi

  # WHY: no-progress detection — empty git diff OR identical failure signature means no new ground.
  cur_head="$(git rev-parse HEAD 2>/dev/null || echo none)"
  cur_sig="$(failure_signature)"
  no_commit=0
  if [[ "$cur_head" == "$iter_start_head" ]] && git diff --quiet 2>/dev/null; then no_commit=1; fi
  if (( no_commit == 1 )) || [[ "$cur_sig" == "$prev_sig" ]]; then
    no_progress=$(( no_progress + 1 ))
    echo "[loop] no-progress signal (${no_progress}/${NO_PROGRESS_LIMIT})"
  else
    no_progress=0
  fi
  if (( no_progress >= NO_PROGRESS_LIMIT )); then
    log_diag "STOP: no progress for ${NO_PROGRESS_LIMIT} consecutive iterations (no new commit / identical failure)"
    echo "[loop] STOP: no progress — human checkpoint; diagnostics in ${LEDGER}"; exit 4
  fi
  prev_sig="$cur_sig"; prev_head="$cur_head"
done

# WHY: iteration cap reached without completion — hard stop, hand back to a human. The cap
# is the one stop condition that lives entirely outside the model.
log_diag "STOP: reached --max-iterations ${MAX_ITERATIONS} without completion"
echo "[loop] STOP: max iterations reached without completion"
exit 4
