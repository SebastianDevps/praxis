#!/usr/bin/env bash
# loop.sh — guarded autonomous build loop ("ralph") driver for Praxis.
#
# Re-invokes `claude -p` on a FRESH context each iteration. The loop's memory is the
# filesystem: PROGRESS.md (the ledger) + git history. ALL stop-limits are enforced HERE,
# in bash, OUTSIDE the model — a runner safety bound on an opt-in process, never a gate on
# the user's interactive session.
#
# Each guardrail below is commented with WHY it exists.

set -euo pipefail

# ---- defaults (every guardrail is a flag) -----------------------------------------------
TASK=""                       # one-line goal injected into each iteration prompt
LEDGER="PROGRESS.md"          # durable progress file; the loop's only memory across iterations
MAX_ITERATIONS=20             # WHY: hard ceiling — the iteration cap is the primary cost proxy
MAX_DURATION="2h"             # WHY: wall-clock kill-switch — catches a hung/runaway iteration
MAX_COST=""                   # WHY: optional cumulative USD cap (best-effort; see note below)
DONE_STREAK=3                 # WHY: one "DONE" is noise — require N consecutive done-markers
NO_PROGRESS_LIMIT=2           # WHY: identical failure or zero diff N times = stuck, not converging
DONE_MARKER="LOOP_COMPLETE"   # the agent must emit this line when it believes work is finished
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

usage() {
  cat <<'EOF'
Usage: bash scripts/loop.sh --task "<goal>" [options]

  --task TEXT             One-line goal (required). Injected into every iteration prompt.
  --ledger PATH           Progress ledger file (default: PROGRESS.md).
  --max-iterations N      Hard iteration ceiling (default: 20).
  --max-duration DUR      Wall-clock cap, e.g. 30m, 2h (default: 2h).
  --max-cost USD          Cumulative cost cap, best-effort (default: unset — see notes).
  --done-streak N         Consecutive done-markers required to stop (default: 3).
  --no-progress-limit N   Consecutive no-progress iterations before halt (default: 2).
  --done-marker STR       Completion sentinel the agent emits (default: LOOP_COMPLETE).
  -h, --help              Show this help.

Stop-limits are enforced in bash, OUTSIDE the model. Guardrails:
  hard iteration cap · wall-clock timeout · best-effort cost cap · no-progress detection
  · done-streak confirmation · verifier-integrity guard (halts if a test file is touched)
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
    -h|--help)          usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -n "$TASK" ]] || { echo "error: --task is required" >&2; usage; exit 2; }
command -v "$CLAUDE_BIN" >/dev/null 2>&1 || { echo "error: '$CLAUDE_BIN' not found on PATH" >&2; exit 2; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "error: not inside a git repo — the loop uses git as its progress signal" >&2; exit 2; }

# WHY: the ledger is the loop's only memory. No ledger => no loop. Seed one if absent.
if [[ ! -f "$LEDGER" ]]; then
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
# means we are stuck (not converging), not making different progress.
failure_signature() {
  { git diff --stat 2>/dev/null; git status --porcelain 2>/dev/null; } | shasum | awk '{print $1}'
}

# WHY: reward-hacking guard. Strong models delete/edit tests to force green. If this iteration
# touched any test file, the verifier is compromised — HALT and alert, never accept the iteration.
TEST_FILE_RE='(^|/)(test|tests|__tests__|spec)/|(\.|_|-)(test|spec)\.[a-z]+$|_test\.[a-z]+$'
touched_test_file() {
  git diff --name-only "$1" HEAD 2>/dev/null | grep -Eiq "$TEST_FILE_RE"
}

log_diag() { printf '\n<!-- loop %s: %s -->\n' "$(date -u +%FT%TZ)" "$1" >> "$LEDGER"; }

# ---- the loop ---------------------------------------------------------------------------
done_streak=0
no_progress=0
prev_sig="$(failure_signature)"
prev_head="$(git rev-parse HEAD 2>/dev/null || echo none)"
total_cost="0"

PROMPT_TEMPLATE="You are one iteration of an autonomous ralph loop. Read ${LEDGER} to reconstruct state — do NOT assume memory of prior iterations. Pick the SINGLE highest-priority incomplete item. Search the codebase before implementing. Write real code: NO placeholders, NO stubs. NEVER modify or delete test files. Update ${LEDGER} when done. Goal: ${TASK}. When ALL work is complete and verified, emit a line containing exactly: ${DONE_MARKER}"

for (( iter=1; iter<=MAX_ITERATIONS; iter++ )); do
  # WHY: wall-clock cap — bound total runtime regardless of iteration count.
  if (( $(date +%s) >= DEADLINE )); then
    log_diag "STOP: wall-clock deadline reached (--max-duration ${MAX_DURATION})"
    echo "[loop] STOP: max duration reached"; exit 0
  fi

  echo "[loop] iteration ${iter}/${MAX_ITERATIONS}"
  iter_start_head="$(git rev-parse HEAD 2>/dev/null || echo none)"

  # Fresh context each iteration: a new `claude -p` invocation, fed prompt + ledger.
  set +e
  OUTPUT="$("$CLAUDE_BIN" -p "$PROMPT_TEMPLATE" 2>&1)"
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
        echo "[loop] STOP: cost cap reached (${total_cost} >= ${MAX_COST})"; exit 0
      fi
    else
      echo "[loop] NOTE: --max-cost set but no cost emitted by '$CLAUDE_BIN' this iteration; cannot enforce — relying on iteration/time caps" >&2
    fi
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
    echo "[loop] STOP: no progress — human checkpoint; diagnostics in ${LEDGER}"; exit 0
  fi
  prev_sig="$cur_sig"; prev_head="$cur_head"

  # WHY: completion confirmation — require the done-marker N consecutive times, never on a single hit.
  if printf '%s\n' "$OUTPUT" | grep -qF "$DONE_MARKER"; then
    done_streak=$(( done_streak + 1 ))
    echo "[loop] done-marker seen (${done_streak}/${DONE_STREAK})"
  else
    done_streak=0
  fi
  if (( done_streak >= DONE_STREAK )); then
    log_diag "DONE: completion signal confirmed ${DONE_STREAK}x"
    echo "[loop] DONE: completion confirmed ${DONE_STREAK} consecutive times"; exit 0
  fi
done

# WHY: iteration cap reached without completion — hard stop, hand back to a human.
log_diag "STOP: reached --max-iterations ${MAX_ITERATIONS} without completion"
echo "[loop] STOP: max iterations reached without completion"
exit 0
