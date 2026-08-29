// Tier 3 smoke — can this instrument SEE a skill activation at all?
//
// Not a measurement. A gate on one before spending on sixty.
//
// The open question is whether Praxis's Spanish gap is real. Two instruments already say it is —
// the lexical audit (EN 69.2% vs ES 23.5%) and the activation audit over 961 real transcripts,
// where skills fired 3 times in 154 opportunities and named the English-description/Spanish-user
// mismatch as the cause. A behavioural eval is worth paying for only if it can distinguish arms.
//
// It cannot, if skills rarely fire for reasons unrelated to language: both arms land near zero and
// the run buys nothing. That is exactly the failure that made the first two paid evals
// inconclusive here, and it was predictable both times.
//
// So: ten ENGLISH prompts, each one a best case — an unambiguous request whose skill exists and
// whose vocabulary matches. If the expected skill does not fire even here, the gap is not about
// Spanish and the sixty-cell run must not be launched.
//
//   node evals/route/smoke.mjs --dry-run   # prints the plan, spends nothing
//   node evals/route/smoke.mjs --run       # ~10 short sessions
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/evals\/$/, "");
const MODEL = process.env.ROUTE_MODEL ?? "claude-sonnet-4-6";
const CONCURRENCY = Number(process.env.ROUTE_CONCURRENCY ?? 3);

// Best cases on purpose. A smoke that fails on an ambiguous prompt tells you nothing about the
// instrument — you cannot tell a blind detector from a genuinely unroutable prompt.
export const CASES = [
  { owner: "frontend-design", prompt: "Build a pricing page with three tiers and a monthly/annual toggle." },
  { owner: "systematic-debugging", prompt: "This test fails intermittently in CI but passes locally. Find out why." },
  { owner: "writing-plans", prompt: "Break this multi-file refactor into a written checklist before we start." },
  { owner: "test-coverage-plan", prompt: "What should we test for this new checkout flow?" },
  { owner: "copywriting", prompt: "Our error messages all say 'Something went wrong'. Rewrite them." },
  { owner: "design-review", prompt: "Review this component and tell me what is wrong with it." },
  { owner: "scout", prompt: "Before I add a rate limiter, is there anything like it already in this codebase?" },
  { owner: "strategy-compare", prompt: "We could use a cron job, a queue, or a durable object here. Compare them." },
  { owner: "security", prompt: "Audit this login handler for OWASP issues." },
  { owner: "data-visualization", prompt: "Chart this revenue time series so the trend is readable." },
];

// The transcript, not the reply. A model that says "I used frontend-design" is narration; the
// tool_use block is what the system can derive. This is the whole reason Tier 3 is worth more than
// re-reading answers — never soften it back into text matching.
function skillsInvoked(cellId) {
  const projects = join(homedir(), ".claude", "projects");
  if (!existsSync(projects)) return { found: false, skills: [], tools: {} };
  // Match the directory by a token unique to this cell rather than recomputing Claude Code's
  // path-slug rule. The rule maps both `/` and `_` to `-`; replicating it is a second source of
  // truth that can silently drift out of step with the host.
  const dir = readdirSync(projects).filter((d) => d.includes(cellId.replace(/_/g, "-"))).sort().pop();
  if (!dir) return { found: false, skills: [], tools: {} };
  const files = readdirSync(join(projects, dir)).filter((f) => f.endsWith(".jsonl"));
  const skills = [], tools = {};
  for (const f of files) {
    for (const line of readFileSync(join(projects, dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const content = j.message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b.type !== "tool_use") continue;
        tools[b.name] = (tools[b.name] ?? 0) + 1;
        if (b.name === "Skill" && b.input?.skill) skills.push(b.input.skill);
      }
    }
  }
  return { found: true, skills, tools };
}

// A skill is invoked as `praxis:test-coverage-plan`, not `test-coverage-plan`. The first version
// compared the bare name and scored both real hits as misses — 0/10 where the truth was 2/10, and
// the printed table showed the correct skill name on the same line as the word "other". The same
// class as the BLOCK-inside-a-negation bug in the refute scorer: a predicate that reads plausibly
// and is wrong in one direction only. Strip the host's namespace before comparing.
export const hits = (skills, owner) => skills.some((s) => String(s).split(":").pop() === owner);

async function cell(c, i, runDir) {
  const id = `route-${String(i).padStart(2, "0")}-${c.owner}`;
  const work = join(runDir, id);
  mkdirSync(work, { recursive: true });
  // A bare directory, so nothing in a real repo steers the routing. The plugin is loaded
  // explicitly and global plugins are excluded, or the control runs with whatever this machine
  // happens to have installed and measures nothing.
  writeFileSync(join(work, "README.md"), "# scratch\n");
  let cost = 0, error = null;
  try {
    const { stdout } = await execFileAsync("claude", [
      "-p", c.prompt,
      "--output-format", "json",
      "--model", MODEL,
      "--permission-mode", "bypassPermissions",
      "--setting-sources", "project,local",
      "--plugin-dir", ROOT,
    ], { cwd: work, encoding: "utf8", timeout: 300_000, maxBuffer: 32 * 1024 * 1024 });
    const r = JSON.parse(stdout);
    cost = r.total_cost_usd ?? 0;
    if (r.is_error) error = "session error";
  } catch (e) {
    error = String(e.message).slice(0, 160);
  }
  const t = skillsInvoked(id);
  return { ...c, id, cost, error, ...t, hit: hits(t.skills, c.owner) };
}

async function pool(items, fn, n) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!process.argv.includes("--run") && !dry) {
    console.log("pass --dry-run (free) or --run (spends). See the header for why this exists.");
    return;
  }
  console.log(`Tier 3 smoke — ${CASES.length} English best-case prompts · model ${MODEL}\n`);
  if (dry) {
    for (const c of CASES) console.log(`  ${c.owner.padEnd(22)} "${c.prompt}"`);
    console.log(`\n${CASES.length} cells would run. Nothing spent.`);
    return;
  }

  const runDir = join(ROOT, "evals", "route", "runs", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  mkdirSync(runDir, { recursive: true });
  const rows = await pool(CASES, (c, i) => cell(c, i, runDir), CONCURRENCY);

  console.log("expected".padEnd(23), "fired?".padEnd(8), "skills actually invoked");
  for (const r of rows) {
    const mark = r.error ? "ERROR" : r.hit ? "yes" : r.skills.length ? "other" : "none";
    console.log(r.owner.padEnd(23), mark.padEnd(8), r.skills.join(", ") || (r.found ? "(no Skill call)" : "(no transcript)"));
  }
  const hits = rows.filter((r) => r.hit).length;
  const any = rows.filter((r) => r.skills.length > 0).length;
  const cost = rows.reduce((a, r) => a + r.cost, 0);
  const noTranscript = rows.filter((r) => !r.found).length;

  console.log(`\nexpected skill fired : ${hits}/${rows.length}`);
  console.log(`any skill fired      : ${any}/${rows.length}`);
  console.log(`transcript missing   : ${noTranscript}/${rows.length}`);
  console.log(`cost                 : $${cost.toFixed(2)}  (~$${(cost / rows.length).toFixed(3)}/cell)`);
  writeFileSync(join(runDir, "smoke.json"), JSON.stringify(rows, null, 2));

  // A cell that only ran Bash and Read did not route anywhere — but in a bare workspace that can
  // equally mean the prompt had nothing to act on. Counting it as a routing failure is the
  // confound the first run walked into; report it separately rather than folding it into a score.
  const inspected = rows.filter((r) => !r.skills.length && !(r.tools.Agent > 0) && !r.error).length;

  console.log("\nVERDICT");
  if (noTranscript > 0) {
    console.log("  BLOCKED — the transcript reader found nothing. Fix the detector before believing any");
    console.log("  number here: a blind detector reports 0/10 identically to a router that never fired.");
  } else if (inspected > rows.length / 3) {
    console.log(`  INCONCLUSIVE — ${inspected}/${rows.length} cells only inspected the workspace instead of routing.`);
    console.log("  In a bare directory that is ambiguous: a prompt naming code that does not exist cannot");
    console.log("  be routed OR answered, so 'no skill fired' does not mean routing failed. Seed a fixture");
    console.log("  the prompt can actually act on — as evals/refute does — and re-run before spending more.");
  } else if (any === 0) {
    console.log("  STOP — no skill fired on ten best-case English prompts. The gap is not about Spanish,");
    console.log("  and a 60-cell language A/B would compare two arms that both read zero. Investigate why");
    console.log("  skills do not activate at all before spending.");
  } else if (hits < 3) {
    console.log(`  WEAK — skills fire (${any}/${rows.length}) but rarely the expected one (${hits}/${rows.length}).`);
    console.log("  The instrument works; the measurement it would produce is noisy. A Spanish arm would");
    console.log("  land within a cell or two of this, which is not a difference — it is sampling.");
  } else {
    console.log(`  GO — the detector works and the expected skill fires ${hits}/${rows.length} on English best cases.`);
    console.log("  A Spanish arm measured against this baseline can distinguish a real gap from noise.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
