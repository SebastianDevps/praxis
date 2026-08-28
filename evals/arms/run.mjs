// Arms comparison — does the injection layer change what gets produced?
//
//   node evals/arms/run.mjs --selftest              prove every scorer, no API, no spend
//   node evals/arms/run.mjs --run [--n 2] [--tasks hero,vague] [--arms baseline,praxis]
//   node evals/arms/run.mjs --rescore runs/<stamp>  recompute offline after a scorer change
//
// The arms are chosen so this can DISPROVE the layer, not only confirm it:
//
//   baseline     no plugin at all
//   router-only  Praxis as it was before per-turn and per-subagent injection.
//                If this matches `praxis`, the layer bought nothing and should go.
//   praxis       the full plugin
//   prompt       twenty words of plain instruction, no plugin. If a short prompt
//                matches the framework, the framework is not earning its keep.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir, homedir } from "node:os";
import { TASKS, refContext } from "./tasks.mjs";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RUNS = join(ROOT, "evals", "arms", "runs");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const MODEL = flag("--model", "claude-haiku-4-5-20251001");

const PROMPT_ARM =
  "Prefer a distinctive font over Inter or Roboto. Keep accessibility basics: alt text, " +
  "labelled inputs. Delegate independent work to subagents. Ask before guessing on a vague request.";

// ---------------------------------------------------------------- selftest ---
function selftest() {
  let failed = 0;
  console.log("\nscorer selftest — the good reference must pass, the bad one must be caught\n");
  for (const task of TASKS) {
    for (const [name, metric] of Object.entries(task.metrics)) {
      const g = metric.score(refContext(metric.good));
      const b = metric.score(refContext(metric.bad));
      const ok = g.pass === true && b.pass === false;
      if (!ok) failed++;
      console.log(`  ${ok ? "ok  " : "FAIL"}  ${task.id}/${name}` +
        (ok ? "" : `   good=${g.pass} (${g.detail})  bad=${b.pass} (${b.detail})`));
    }
  }
  console.log(failed ? `\n${failed} scorer(s) unusable — no run until these pass.\n` : "\nAll scorers verified. Safe to spend.\n");
  return failed;
}

// ------------------------------------------------------------------- arms ---
// router-only is built by stripping the two newer hooks from a copy of the
// plugin, so the control is this exact tree minus the layer under test — not a
// git checkout of an older commit, which would differ in unrelated ways too.
function routerOnlyPlugin() {
  const dir = mkdtempSync(join(tmpdir(), "praxis-router-only-"));
  cpSync(ROOT, dir, { recursive: true, filter: (s) => !/\/(\.git|node_modules|runs)(\/|$)/.test(s) });
  const cfg = join(dir, "hooks", "hooks.json");
  const parsed = JSON.parse(readFileSync(cfg, "utf8"));
  delete parsed.hooks.UserPromptSubmit;
  delete parsed.hooks.SubagentStart;
  writeFileSync(cfg, JSON.stringify(parsed, null, 2));
  return dir;
}

const ARMS = {
  baseline: () => ({ args: [] }),
  "router-only": (routerDir) => ({ args: ["--plugin-dir", routerDir] }),
  praxis: () => ({ args: ["--plugin-dir", ROOT] }),
  prompt: () => ({ args: ["--append-system-prompt", PROMPT_ARM] }),
};

// -------------------------------------------------------------- execution ---
function collectFiles(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (statSync(p).size < 512 * 1024) out[relative(dir, p)] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return out;
}

// Identified by session_id, never by size or path mention: an earlier version of
// the smoke test matched the developer's own transcript and reported a false pass.
function parentTranscript(sessionId) {
  const base = join(homedir(), ".claude", "projects");
  let found = "";
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === `${sessionId}.jsonl`) found = readFileSync(p, "utf8");
    }
  };
  try { walk(base); } catch { /* none */ }
  return found;
}

function cell(task, arm, routerDir, workRoot, i) {
  const work = join(workRoot, `${task.id}__${arm}__${i}`);
  mkdirSync(work, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: work });

  let result = {};
  try {
    const raw = execFileSync("claude", [
      "-p", task.prompt,
      "--output-format", "json",
      "--model", MODEL,
      "--permission-mode", "bypassPermissions",
      // Excludes the user's globally-installed plugins. Without it every arm,
      // baseline included, silently runs whatever is installed — the contamination
      // that invalidated ponytail's first agentic benchmark.
      "--setting-sources", "project,local",
      ...ARMS[arm](routerDir).args,
    ], { cwd: work, encoding: "utf8", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
    result = JSON.parse(raw);
  } catch (e) {
    result = { is_error: true, error: String(e.message).slice(0, 300) };
  }

  const record = {
    task: task.id, arm, i,
    session_id: result.session_id ?? null,
    cost: result.total_cost_usd ?? 0,
    turns: result.num_turns ?? 0,
    error: result.is_error ? (result.error ?? "session error") : null,
    reply: typeof result.result === "string" ? result.result : "",
    files: collectFiles(work),
    parent: result.session_id ? parentTranscript(result.session_id) : "",
  };
  writeFileSync(join(work, "..", `${task.id}__${arm}__${i}.json`), JSON.stringify(record));
  return record;
}

// ---------------------------------------------------------------- scoring ---
function scoreAll(records) {
  const rows = [];
  for (const task of TASKS) {
    for (const [name, metric] of Object.entries(task.metrics)) {
      const byArm = {};
      for (const r of records.filter((r) => r.task === task.id)) {
        const v = metric.score(r);
        (byArm[r.arm] ??= []).push(v.pass);
      }
      rows.push({ task: task.id, metric: name, byArm });
    }
  }
  return rows;
}

function report(records, rows) {
  const arms = [...new Set(records.map((r) => r.arm))];
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad("task / metric", 42)}${arms.map((a) => pad(a, 14)).join("")}`);
  console.log("-".repeat(42 + arms.length * 14));
  for (const row of rows) {
    const cells = arms.map((a) => {
      const vals = (row.byArm[a] ?? []).filter((v) => v !== null);
      if (!vals.length) return pad("n/a", 14);
      const passed = vals.filter(Boolean).length;
      return pad(`${passed}/${vals.length}`, 14);
    });
    console.log(pad(`${row.task} / ${row.metric}`.slice(0, 41), 42) + cells.join(""));
  }
  const spend = records.reduce((a, r) => a + r.cost, 0);
  const errors = records.filter((r) => r.error);
  console.log(`\ncells: ${records.length}   spend: $${spend.toFixed(2)}   errors: ${errors.length}`);
  for (const e of errors.slice(0, 3)) console.log(`  ! ${e.task}/${e.arm}#${e.i}: ${e.error}`);
  console.log("\nn is small; read this as direction, not a rate. Workspaces are kept for --rescore.\n");
}

// ------------------------------------------------------------------- main ---
if (argv.includes("--selftest")) process.exit(selftest() ? 1 : 0);

if (argv.includes("--rescore")) {
  const dir = flag("--rescore", null);
  const records = readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  report(records, scoreAll(records));
  process.exit(0);
}

if (!argv.includes("--run")) {
  console.log("usage: --selftest | --run [--n 2] [--tasks a,b] [--arms a,b] | --rescore <dir>");
  process.exit(1);
}

// Never spend on instruments that have not proven they can catch a bad reference.
if (selftest()) process.exit(1);

const n = Number(flag("--n", 2));
const tasks = TASKS.filter((t) => (flag("--tasks", null) ?? t.id).split(",").includes(t.id));
const arms = (flag("--arms", Object.keys(ARMS).join(","))).split(",");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const workRoot = join(RUNS, stamp);
mkdirSync(workRoot, { recursive: true });
const routerDir = arms.includes("router-only") ? routerOnlyPlugin() : null;

const total = tasks.length * arms.length * n;
console.log(`${total} cells (${tasks.length} tasks x ${arms.length} arms x n=${n}) on ${MODEL}`);
console.log(`workspaces: ${workRoot}\n`);

const records = [];
let done = 0;
for (const task of tasks) for (const arm of arms) for (let i = 0; i < n; i++) {
  process.stdout.write(`  [${++done}/${total}] ${task.id} / ${arm} #${i} ... `);
  const r = cell(task, arm, routerDir, workRoot, i);
  records.push(r);
  console.log(r.error ? `ERROR` : `$${r.cost.toFixed(3)}`);
}
if (routerDir) rmSync(routerDir, { recursive: true, force: true });
report(records, scoreAll(records));
