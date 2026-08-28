// Live smoke test — do the hooks actually fire, and does the host consume them?
//
// Every other test in this repo executes a hook directly and inspects its stdout.
// That proves the script is correct; it cannot prove Claude Code invokes it, nor
// that the emitted JSON reaches the model. This runs one real headless session in
// a throwaway workspace and checks both.
//
//   node evals/smoke/live-hooks.mjs [--keep]
//
// Costs one small Haiku session. Isolated three ways: a fresh temp workspace,
// --setting-sources project,local so the user's globally-installed plugins cannot
// contaminate the run, and --plugin-dir pointing at this working tree rather than
// whatever version happens to sit in the plugin cache.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const KEEP = process.argv.includes("--keep");
const MODEL = "claude-haiku-4-5-20251001";

const startedAt = Date.now();
const work = mkdtempSync(join(tmpdir(), "praxis-smoke-"));
const trace = join(work, "hooks.trace");
writeFileSync(join(work, "notes.txt"), "one line\n");
execFileSync("git", ["init", "-q"], { cwd: work });

// The task exists only to force a dispatch: SubagentStart is the event that
// cannot be observed any other way, and it is the one carrying crafts and skills.
const PROMPT = [
  "Dispatch the praxis:engineer subagent to append the line 'two' to notes.txt.",
  "Do not edit the file yourself — the dispatch is the point of this task.",
].join(" ");

console.log(`workspace: ${work}\nrunning one headless session (${MODEL})...\n`);

let raw;
try {
  raw = execFileSync("claude", [
    "-p", PROMPT,
    "--output-format", "json",
    "--model", MODEL,
    "--permission-mode", "bypassPermissions",
    "--setting-sources", "project,local",
    "--plugin-dir", ROOT,
  ], {
    cwd: work,
    env: { ...process.env, PRAXIS_HOOK_TRACE: trace },
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  console.error(`session failed: ${e.message}`);
  console.error((e.stdout ?? "").slice(0, 2000));
  process.exit(1);
}

const result = JSON.parse(raw);

// --- 1. did the hooks run at all? -------------------------------------------
const traceLines = existsSync(trace) ? readFileSync(trace, "utf8").trim().split("\n").filter(Boolean) : [];
const fired = new Set(traceLines.map((l) => l.split("\t")[1]));

// --- 2. did the host actually inject what they emitted? ----------------------
// The transcript is the only place that answers this: a hook can emit perfect
// JSON that the host discards, which is exactly the failure Cursor's user_message
// turned out to be.
// Identify transcripts by session id, never by size or path mention. The first
// version took the largest file mentioning the workspace and picked up the
// developer's own session — which quoted the injected text in tool output and
// would have reported a false pass. The parent writes <session_id>.jsonl; each
// dispatched subagent writes its own agent-*.jsonl beside it.
function transcripts(sessionId, startedAt) {
  const base = join(homedir(), ".claude", "projects");
  let parent = "", subagents = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith(".jsonl")) continue;
      if (e.name === `${sessionId}.jsonl`) parent = readFileSync(p, "utf8");
      else if (e.name.startsWith("agent-") && statSync(p).mtimeMs >= startedAt) subagents.push(readFileSync(p, "utf8"));
    }
  };
  try { walk(base); } catch { /* none */ }
  return { parent, subagents };
}
const { parent, subagents } = transcripts(result.session_id, startedAt);
const dispatched = subagents.join("\n");

const checks = [
  ["SessionStart fired", fired.has("SessionStart")],
  ["UserPromptSubmit fired", fired.has("UserPromptSubmit")],
  ["SubagentStart fired", fired.has("SubagentStart")],
  ["a subagent was actually dispatched", /"subagent_type"\s*:\s*"praxis:engineer"/.test(parent)],
  ["the router reached the session", parent.includes("This environment has the Praxis framework active")],
  ["the per-turn contract reached the model", parent.includes("PRAXIS — active mode:")],
  // These are checked in the SUBAGENT's transcript. SessionStart context is
  // parent-only, so the parent carrying them would prove nothing about dispatch.
  ["the specialist received the contract", dispatched.includes("PRAXIS — active mode:")],
  ["the specialist received its crafts", dispatched.includes("Craft — minimalism")],
  ["the specialist received its skill pointers", dispatched.includes("Skills declared for")],
  ["the specialist was NOT told to render Run Cards", subagents.length > 0 && !dispatched.includes("RUN CARD —")],
  ["skill bodies did NOT leak into the dispatch", subagents.length > 0 && !dispatched.includes("## The Ship Gate")],
];

console.log("check                                          result");
console.log("-".repeat(58));
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed++;
  console.log(`${label.padEnd(46)} ${ok ? "pass" : "FAIL"}`);
}

console.log(`\ntrace events: ${traceLines.length}   parent: ${parent ? `${(parent.length / 1024).toFixed(0)} KB` : "NOT FOUND"}   subagent transcripts: ${subagents.length}`);
console.log(`cost: $${(result.total_cost_usd ?? 0).toFixed(4)}   turns: ${result.num_turns ?? "?"}   ${result.is_error ? "SESSION ERROR" : ""}`);

if (KEEP) console.log(`\nkept: ${work}`);
else rmSync(work, { recursive: true, force: true });

if (!parent) console.log("\nParent transcript not found — the consumption checks are inconclusive, not failed.");
if (!subagents.length) console.log("No subagent transcript — the dispatch-side checks are inconclusive, not failed.");
process.exit(failed ? 1 : 0);
