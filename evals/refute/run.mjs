// Does the refuter panel find what the reviewer misses — and is it the mandate or the compute?
//
//   node evals/refute/run.mjs --selftest            free; must pass before any spend
//   node evals/refute/run.mjs --run [--n 2] [--tasks a,b] [--arms a,b]
//   node evals/refute/run.mjs --rescore <dir>       re-score kept workspaces, no API calls
//
// THREE ARMS, and the third is the point:
//   reviewer      one `reviewer` pass — the status quo
//   reviewer-x3   three `reviewer` passes — same session count, same spend, same mandate
//   refuters      the three-lens panel — same session count, DIFFERENT mandate
//
// Two arms would confound the contract with the compute. If `refuters` only matches `reviewer-x3`,
// the panel is buying sampling and the contract does not earn its complexity — which is a result
// worth having, and the reason this arm exists at all. Published work already ran that comparison
// once (three adversarial agents beat a five-agent baseline); see docs/adversarial-review.md, and
// note what that does to the size of the claim this eval is allowed to make.
//
// NO ORCHESTRATOR HOP. The first version dispatched subagents from a headless orchestrator, which
// meant every cell paid for a session that read the repo, wrote three prompts and summarised three
// replies — none of which is the variable. Each lens now runs as its own session with the agent's
// own body inlined as its role, and the union of their replies is assembled here rather than by a
// model. Two consequences, both deliberate:
//
//   - It is ~40% cheaper and, run in parallel, several times faster.
//   - It scores what the lenses FOUND, not what survived a summarisation step. Whether the
//     orchestrator drops findings while synthesising is a real question, and a different one.
//
// Crafts are not injected. Both `reviewer` and the refuters require exactly `minimalism`, so it
// cancels between arms — inlining it would cost tokens in every cell and move no number.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS, refContext, dispatched } from "./tasks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODEL = process.env.REFUTE_MODEL ?? "claude-sonnet-4-6";
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

// An arm is the set of agent bodies to run, one session each. `reviewer-x3` repeats the same body
// three times on purpose: identical mandate, triple the compute, which is the control.
export const ARMS = {
  reviewer: ["reviewer"],
  "reviewer-x3": ["reviewer", "reviewer", "reviewer"],
  refuters: ["refuter-correctness", "refuter-security", "refuter-tests"],
};

// The agent body IS the role. Strip the frontmatter — it is host metadata, not instructions.
export const agentBody = (name) =>
  readFileSync(join(ROOT, "agents", `${name}.md`), "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "").trim();

// A cell may run several sessions at once; a wave may run several cells at once. Bound the total so
// a burst of concurrent CLI processes does not hit a rate limit and turn throughput into errors.
// Bounds concurrent CELLS. Each cell runs its lenses concurrently too, so the real ceiling is
// CONCURRENCY x 3 processes. Two is deliberate: six concurrent CLI sessions is throughput, twelve
// is a rate limit dressed up as errors.
const CONCURRENCY = Number(process.env.REFUTE_CONCURRENCY ?? 2);
async function pool(items, worker, limit = CONCURRENCY) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await worker(items[i], i);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- selftest ---
// An instrument that cannot catch its own bad reference is not an instrument. This runs free and
// gates every spend below it.
export function selftest(quiet = false) {
  const say = quiet ? () => {} : console.log;
  say("\nscorer selftest — the good reply must pass, the bad one must be caught\n");
  let failed = 0;
  for (const task of TASKS) {
    for (const [name, metric] of Object.entries(task.metrics)) {
      // `good`/`bad` prove the scorer works at all. `alt`/`near` are the ones that keep it
      // honest: alt is a genuine find phrased differently and MUST pass, near names the area
      // without naming the defect and MUST NOT. Two alt probes failed on the first pass here —
      // a scorer that rejects a real find is a silent bias toward whichever arm phrases things
      // the way the author happened to imagine.
      const probes = [
        ["good", metric.good.__reply, true],
        ["bad", metric.bad.__reply, false],
        ...(metric.alt ?? []).map((r) => ["alt", r, true]),
        ...(metric.near ?? []).map((r) => ["near", r, false]),
      ];
      for (const [kind, reply, want] of probes) {
        const got = metric.score(refContext({ __reply: reply })).pass === true;
        const ok = got === want;
        if (!ok) failed++;
        say(`  ${ok ? "ok  " : "FAIL"}  ${task.id}/${name} [${kind}] ${reply.slice(0, 52)}…`);
      }
    }
  }
  say(failed ? `\n${failed} scorer check(s) failed — no run until these pass.\n` : "\nAll scorers verified. Safe to spend.\n");
  return failed;
}

// -------------------------------------------------------------------- run ---
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

// One lens, one session. Returns the reply and its cost; an error becomes an empty reply so the
// validity check below can tell "ran and found nothing" from "never ran".
async function session(work, prompt, agent) {
  const framed =
    `You are acting as the following reviewer. This is your complete role definition.\n\n` +
    `${agentBody(agent)}\n\n---\n\n${prompt}`;
  try {
    const { stdout } = await execFileAsync("claude", [
      "-p", framed,
      "--output-format", "json",
      "--model", MODEL,
      "--permission-mode", "bypassPermissions",
      // Excludes globally-installed plugins so only the --plugin-dir below is loaded. A control
      // that silently ran with whatever the machine has installed measures nothing.
      "--setting-sources", "project,local",
      "--plugin-dir", ROOT,
    ], { cwd: work, encoding: "utf8", timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
    const r = JSON.parse(stdout);
    return { reply: typeof r.result === "string" ? r.result : "", cost: r.total_cost_usd ?? 0, error: r.is_error ? "session error" : null };
  } catch (e) {
    return { reply: "", cost: 0, error: String(e.message).slice(0, 200) };
  }
}

async function cell(task, arm, workRoot, i) {
  const work = join(workRoot, `${task.id}__${arm}__${i}`);
  mkdirSync(work, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: work });
  for (const [name, body] of Object.entries(task.setup)) {
    mkdirSync(dirname(join(work, name)), { recursive: true });
    writeFileSync(join(work, name), body);
  }
  // Commit so "the change on this branch" has a real source state to attach a verdict to — the
  // refuter contract asks for a SHA, and an uncommitted tree cannot give one.
  execFileSync("git", ["add", "-A"], { cwd: work });
  execFileSync("git", ["-c", "user.email=eval@local", "-c", "user.name=eval", "commit", "-qm", "seed"], { cwd: work });

  const agents = ARMS[arm];
  // The lenses of one cell run concurrently — in production they are one parallel wave, and
  // running them in series here would only inflate wall-clock.
  const results = await pool(agents, (a) => session(work, task.prompt, a), agents.length);

  const record = {
    task: task.id, arm, i,
    agents,
    // The union, assembled here rather than by a model. Each lens is labelled so a human reading
    // the artifact can tell which one found what.
    reply: results.map((r, k) => `### ${agents[k]}\n${r.reply}`).join("\n\n"),
    perLens: results.map((r, k) => ({ agent: agents[k], chars: r.reply.length, cost: r.cost, error: r.error })),
    cost: results.reduce((a, r) => a + r.cost, 0),
    error: results.every((r) => r.error) ? results[0].error : null,
  };
  writeFileSync(join(workRoot, `${task.id}__${arm}__${i}.json`), JSON.stringify(record));
  return record;
}

// VALIDITY, not result: a lens whose session errored or returned nothing did not run the condition.
// Scoring that as a miss would blame the contract for a session that never happened. There is no
// dispatch to verify any more — each lens IS a session — so the check moved to "did every lens
// actually answer".
const valid = (r) => (r.perLens ?? []).length > 0 && r.perLens.every((l) => !l.error && l.chars > 0);

// ---------------------------------------------------------------- scoring ---
function scoreAll(records) {
  const rows = [];
  for (const task of TASKS) {
    for (const [name, metric] of Object.entries(task.metrics)) {
      const byArm = {};
      for (const r of records.filter((x) => x.task === task.id)) {
        (byArm[r.arm] ??= []).push(valid(r) ? metric.score(r).pass : null);
      }
      rows.push({ task: task.id, metric: name, byArm });
    }
  }
  return rows;
}

function report(records, rows) {
  const arms = [...new Set(records.map((r) => r.arm))];
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad("task / metric", 40)}${arms.map((a) => pad(a, 14)).join("")}`);
  console.log("-".repeat(40 + arms.length * 14));
  for (const row of rows) {
    const cells = arms.map((a) => {
      const vals = (row.byArm[a] ?? []).filter((v) => v !== null);
      if (!vals.length) return pad("n/a", 14);
      return pad(`${vals.filter(Boolean).length}/${vals.length}`, 14);
    });
    console.log(pad(`${row.task} / ${row.metric}`.slice(0, 39), 40) + cells.join(""));
  }

  // Validity and cost are reported per arm because a panel that finds more while costing 3x is a
  // tradeoff, not a win — and a number without its price invites the wrong decision.
  console.log(`\n${pad("", 40)}${arms.map((a) => pad(a, 14)).join("")}`);
  const invalid = arms.map((a) => {
    const rs = records.filter((r) => r.arm === a);
    return pad(`${rs.filter((r) => !valid(r)).length}/${rs.length}`, 14);
  });
  console.log(pad("cells with a lens that did not answer", 40) + invalid.join(""));
  const spend = arms.map((a) =>
    pad(`$${records.filter((r) => r.arm === a).reduce((s, r) => s + r.cost, 0).toFixed(2)}`, 14));
  console.log(pad("spend", 40) + spend.join(""));

  const errors = records.filter((r) => r.error);
  console.log(`\ncells: ${records.length}   spend: $${records.reduce((a, r) => a + r.cost, 0).toFixed(2)}   errors: ${errors.length}`);
  for (const e of errors.slice(0, 3)) console.log(`  ! ${e.task}/${e.arm}#${e.i}: ${e.error}`);
  console.log("\nn is small; read this as direction, not a rate. Workspaces are kept for --rescore.\n");
}

// ------------------------------------------------------------------- main ---
// Guarded so the module can be imported by tests without its CLI firing — without this,
// `import` hits the usage branch and process.exit(2) kills the test run.
if (import.meta.url === `file://${process.argv[1]}`) {

  if (argv.includes("--selftest")) process.exit(selftest() ? 1 : 0);

  if (argv.includes("--rescore")) {
    const dir = flag("--rescore");
    const records = readdirSync(dir).filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
    report(records, scoreAll(records));
    process.exit(0);
}

  if (!argv.includes("--run")) {
    console.log("usage: --selftest | --run [--n 2] [--tasks a,b] [--arms a,b] | --rescore <dir>");
    process.exit(2);
}

  // Never spend on an instrument that has not proved it can catch a bad reference.
  if (selftest()) process.exit(1);

  const n = Number(flag("--n", "2"));
  const taskFilter = flag("--tasks");
  const armFilter = flag("--arms");
  const tasks = TASKS.filter((t) => !taskFilter || taskFilter.split(",").includes(t.id));
  const arms = Object.keys(ARMS).filter((a) => !armFilter || armFilter.split(",").includes(a));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const workRoot = join(ROOT, "evals", "refute", "runs", stamp);
  mkdirSync(workRoot, { recursive: true });

  const total = tasks.length * arms.length * n;
  console.log(`${total} cells (${tasks.length} tasks x ${arms.length} arms x n=${n}) on ${MODEL}`);
  console.log(`workspaces: ${workRoot}\n`);

  // Flattened so the pool sees every cell at once. Progress prints on COMPLETION rather than on
  // start: with cells in flight concurrently, a "starting" line tells you nothing about order.
  const jobs = [];
  for (const task of tasks) for (const arm of arms) for (let i = 0; i < n; i++) jobs.push({ task, arm, i });

  let done = 0;
  const records = await pool(jobs, async ({ task, arm, i }) => {
    const r = await cell(task, arm, workRoot, i);
    console.log(`  [${++done}/${total}] ${task.id} / ${arm} #${i} ... ${r.error ? "ERROR" : `$${r.cost.toFixed(3)}`}`);
    return r;
  });
  report(records, scoreAll(records));
}
