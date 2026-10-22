#!/usr/bin/env node
// run.mjs — the proof that the cycle holds (specs/factory-cycle, Acceptance: the evals/cycle rows).
//
// Runs N cells of `claude -p '/praxis:feature "<request>"'` with the plugin, in acceptEdits,
// inside a throwaway copy of evals/cycle/fixture/ with its own git repo and a local bare `origin`
// so `git push -u origin praxis/<c>` succeeds offline, with the stub `gh` (evals/cycle/bin) first
// on PATH. Two legs per cell, because the floor's one approval is a person's act and `-p` refuses
// `ask`:
//
//   leg 1   the request → spec-writer → spec.md → the orchestrator stops on `Needs your decision`
//           (or its first source edit is answered `ask`, which -p refuses: the same stop)
//   driver  reads .praxis/active-change, runs scripts/approve.sh <c> from the plugin copy — the
//           person approving out of band, exactly as CI would (design.md, Edge Cases: Unattended)
//   leg 2   `--resume <session>` with "approved, continue" → builder → lenses → approver → push + PR
//
// A leg 1 that stops on a clarifying question is recorded as `clarified` and gets no leg 2: the
// driver never answers for the person. Pre-seeding `.praxis/approved/<c>` was rejected: the
// orchestrator names the change, so a marker for a guessed name would orphan the approval and the
// cell would fail for the harness's reason, not the plugin's.
//
// The dial (`full`) is set the way evals/floor does it: the plugin is copied per cell and ONLY
// its hooks.json commands are prefixed with HOME=<isolated>, so the hooks read the cell's
// `.praxis-mode` while `claude` keeps the real HOME (login, config). Fixture, plugin copy and
// HOME live under os.tmpdir(), never inside this repository: Claude Code walks up from cwd for
// CLAUDE.md files, and this repo's parents carry instructions that are not the fixture's.
//
// Kept per cell under runs/<stamp>/cell-N/: transcript.jsonl (both legs, raw stream-json, plus
// `{"type":"driver"}` lines for the leg boundaries and the approval), tree/ (the fixture after
// the run, every .git excluded, the worktree included), gh.log, git-log.txt (praxis/<c> in the
// main repo), origin-log.txt (what was actually pushed), hooks.trace, tests.txt, cell.json,
// score.json. `--rescore <runDir>` re-scores from those without spending.
//
//   node evals/cycle/run.mjs [--n 3] [--n-baseline <k>] [--budget-usd 10] [--timeout-min 30] [--arm cycle|baseline|both] [--no-preflight]
//   node evals/cycle/run.mjs --dry-run [--scenario good|bad|clarified] [--n 1] [--arm ...]
//   node evals/cycle/run.mjs --rescore evals/cycle/runs/<stamp>
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, cpSync, rmSync, appendFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { REQUEST, TASK_CLASS, SCORERS, scoreCell, compareWithMatriz, renderTable, frontmatterField } from "./units.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const FIXTURE = join(HERE, "fixture");
const BIN = join(HERE, "bin");
const STUB = join(HERE, "stub", "claude");
const RUNS = process.env.CYCLE_RUNS_DIR ?? join(HERE, "runs");
// The plugin under test. Default: this checkout. For a run that must not drift while the tree is
// being edited, point CYCLE_PLUGIN_SRC at a frozen snapshot (`git archive HEAD | tar -x -C <dir>`)
// and name its commit in CYCLE_PLUGIN_COMMIT; both are recorded per cell and in summary.json.
const PLUGIN_SRC = process.env.CYCLE_PLUGIN_SRC ? resolve(process.env.CYCLE_PLUGIN_SRC) : ROOT;
const pluginCommit = () => {
  if (process.env.CYCLE_PLUGIN_COMMIT) return process.env.CYCLE_PLUGIN_COMMIT;
  const r = spawnSync("git", ["-C", PLUGIN_SRC, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const dirty = spawnSync("git", ["-C", PLUGIN_SRC, "status", "--porcelain", "hooks", "scripts", "agents", "skills", "commands"], { encoding: "utf8" }).stdout.trim();
  return r.stdout.trim() + (dirty ? "+dirty" : "");
};

export const DEFAULTS = { n: 3, budgetUsd: 10, timeoutMin: 30, arm: "cycle", scenario: "good" };
// Enough for leg 2's first cheap stop to matter; below this the leg is not started.
const MIN_LEG_BUDGET_USD = 1;
const MIN_LEG_MINUTES = 3;

// Bash is the only tool that needs an allowlist in -p; edits are covered by acceptEdits. `bash`
// and `sh` are allowed because scripts/worktree.sh lives in the plugin and the orchestrator
// runs it through one of them — which also opens the Bash path to source. The scorer counts
// those writes (`bashSourceWrites`); the list does not hide them.
export const ALLOWED_TOOLS = [
  "Skill", "Agent", "SendMessage",
  "Bash(git:*)", "Bash(gh:*)", "Bash(node:*)", "Bash(npm:*)", "Bash(bash:*)", "Bash(sh:*)",
  "Bash(cd:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(mkdir:*)", "Bash(printf:*)", "Bash(echo:*)",
  "Bash(wc:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(rg:*)", "Bash(grep:*)", "Bash(diff:*)", "Bash(test:*)",
];

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=cycle", "-c", "user.email=cycle@praxis", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tryGit = (cwd, ...args) => { try { return git(cwd, ...args).trim(); } catch { return ""; } };
const quote = (a) => (/[\s"'$`\\]/.test(a) ? JSON.stringify(a) : a);
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);

// ── fixture ────────────────────────────────────────────────────────────────────────────────────
// A fresh repo on `main` with one commit, and a bare origin it already tracks, so the ship step's
// `git push -u origin praxis/<c>` has somewhere to go without a network.
function seedProject(cellName) {
  const base = mkdtempSync(join(tmpdir(), `cycle-${cellName}-`));
  const project = join(base, "project"), origin = join(base, "origin.git");
  cpSync(FIXTURE, project, { recursive: true });
  git(project, "init", "-q", "-b", "main");
  git(project, "add", "-A");
  git(project, "commit", "-qm", "chore: seed invoices fixture");
  execFileSync("git", ["init", "-q", "--bare", origin]);
  git(project, "remote", "add", "origin", origin);
  git(project, "push", "-q", "-u", "origin", "main");
  return { project, projectReal: realpathSync(project), origin };
}

const isolatedHome = (cellDir, mode = "full") => {
  const home = join(cellDir, "home");
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(join(home, ".claude", ".praxis-mode"), mode);
  return home;
};

const pluginCopy = (cellName, home) => {
  const dir = mkdtempSync(join(tmpdir(), `cycle-plugin-${cellName}-`));
  const skip = [".git", "node_modules", ".praxis"].map((d) => `${PLUGIN_SRC}/${d}`);
  cpSync(PLUGIN_SRC, dir, {
    recursive: true,
    filter: (s) => !skip.some((d) => s === d || s.startsWith(d + "/")) && !/\/evals\/[^/]+\/runs(\/|$)/.test(s),
  });
  const hooksPath = join(dir, "hooks", "hooks.json");
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  for (const group of Object.values(hooks.hooks)) for (const matcher of group) for (const h of matcher.hooks)
    h.command = `HOME=${JSON.stringify(home)} ${h.command}`;
  writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  return dir;
};

// ── one leg of `claude -p` ─────────────────────────────────────────────────────────────────────
const driverLine = (cellDir, obj) => appendFileSync(join(cellDir, "transcript.jsonl"), JSON.stringify({ type: "driver", t: new Date().toISOString(), ...obj }) + "\n");

function runLeg(cellDir, leg, { bin, prompt, resume, plugin, budgetUsd, timeoutMs, env, cwd }) {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--max-budget-usd", String(budgetUsd), "--setting-sources", "project,local", "--allowedTools", ...ALLOWED_TOOLS];
  if (plugin) args.push("--plugin-dir", plugin);
  if (resume) args.push("--resume", resume);
  const command = `cd ${cwd} && ${bin} ${args.map(quote).join(" ")}`;
  driverLine(cellDir, { event: "leg-start", leg, command, budgetUsd, timeoutMs });
  console.log(`  leg ${leg}: ${bin} -p ${quote(prompt).slice(0, 80)}… ($${budgetUsd}, ${Math.round(timeoutMs / 60000)} min)`);
  const started = Date.now();
  const transcript = join(cellDir, "transcript.jsonl");
  return new Promise((done) => {
    let buf = "", stderr = "", result = null, timedOut = false;
    const child = spawn(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 10_000).unref(); }, timeoutMs);
    const onLine = (line) => {
      appendFileSync(transcript, line + "\n");
      if (!line.startsWith("{")) return;
      try {
        const r = JSON.parse(line);
        if (r.type === "result") result = { sessionId: r.session_id ?? null, cost: r.total_cost_usd ?? 0, subtype: r.subtype ?? null, isError: !!r.is_error, numTurns: r.num_turns ?? null };
      } catch { /* a partial or non-JSON line is kept in the transcript as-is */ }
    };
    child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-20_000); });
    const finish = (extra) => {
      clearTimeout(timer);
      if (buf) onLine(buf);
      const out = { leg, exit: extra.code ?? null, signal: extra.signal ?? null, timedOut, wallMs: Date.now() - started, result, stderrTail: stderr.slice(-4000), spawnError: extra.spawnError ?? null };
      driverLine(cellDir, { event: "leg-end", ...out, stderrTail: undefined });
      done(out);
    };
    child.on("error", (err) => finish({ spawnError: err.message }));
    child.on("close", (code, signal) => finish({ code, signal }));
  });
}

// The person's approval, out of band. approve.sh refuses without a spec; that refusal is data.
function approve(cellDir, { plugin, project, change, env }) {
  const r = spawnSync("bash", [join(plugin, "scripts", "approve.sh"), change], { cwd: project, env, encoding: "utf8", timeout: 20_000 });
  const out = { event: "approve", change, exit: r.status, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
  driverLine(cellDir, out);
  console.log(`  approve.sh ${change} → exit ${r.status}: ${out.stdout || out.stderr}`);
  return out;
}

// What leg 1 left: the change name, the spec, and whether the run stopped on a question.
function afterLeg1({ project, leg1, budgetUsd, timeoutMs, finalText }) {
  const read = (rel) => (existsSync(join(project, rel)) ? readFileSync(join(project, rel), "utf8") : null);
  const change = read(".praxis/active-change")?.trim() || null;
  const specPath = change ? ["spec.md", "design.md"].map((f) => `specs/${change}/${f}`).find((p) => existsSync(join(project, p))) ?? null : null;
  const spec = specPath ? read(specPath) : null;
  const openQuestions = spec ? (spec.match(/\[NEEDS CLARIFICATION\]/g) ?? []).length : 0;
  const ready = spec ? frontmatterField(spec, "ready") : null;
  const askedInProse = /\?\s*$/.test((finalText ?? "").trim().slice(-400));
  let stopReason = null;
  if (leg1.spawnError) stopReason = "spawn-error";
  else if (spec && (openQuestions > 0 || ready === "false")) stopReason = "clarified";
  else if (!change && !spec && askedInProse) stopReason = "clarified";
  else if (!change) stopReason = "no-active-change";
  else if (!spec) stopReason = "no-spec";
  else if (leg1.timedOut) stopReason = "timeout";
  else if ((leg1.result?.cost ?? 0) > budgetUsd - MIN_LEG_BUDGET_USD) stopReason = "budget";
  else if (timeoutMs - leg1.wallMs < MIN_LEG_MINUTES * 60_000) stopReason = "timeout";
  return { change, specPath, openQuestions, ready, stopReason };
}

// ── the end of a cell ──────────────────────────────────────────────────────────────────────────
function snapshot(cellDir, { project, origin, change }) {
  cpSync(project, join(cellDir, "tree"), { recursive: true, filter: (s) => basename(s) !== ".git" && basename(s) !== "node_modules" });
  const branch = change ? `praxis/${change}` : null;
  const gitLog = branch ? tryGit(project, "log", "--oneline", `main..${branch}`) : "";
  const originLog = branch ? tryGit(origin, "log", "--oneline", branch) : "";
  const worktrees = tryGit(project, "worktree", "list");
  const status = tryGit(project, "status", "--porcelain", "-uall");
  const wt = change ? join(project, ".praxis", "worktrees", change) : null;
  const testCwd = wt && existsSync(wt) ? wt : project;
  const t = spawnSync("npm", ["test"], { cwd: testCwd, encoding: "utf8", timeout: 60_000 });
  writeFileSync(join(cellDir, "git-log.txt"), gitLog + "\n");
  writeFileSync(join(cellDir, "origin-log.txt"), originLog + "\n");
  writeFileSync(join(cellDir, "tests.txt"), `# npm test in ${testCwd} → exit ${t.status}\n${(t.stdout ?? "") + (t.stderr ?? "")}`);
  return { gitLog, originLog, worktrees, status, testExit: t.status, testCwd };
}

// Before spending: inside a real `claude -p`, with the cell's environment, `gh` must resolve to
// the stub. Claude Code's Bash tool runs in a snapshot of the login shell, and a profile that
// prepends /opt/homebrew/bin puts the real gh back in front — the first dry run hit exactly
// that through `bash -lc`. A live cell whose ship step reaches the real gh scores FAIL for the
// harness's reason, so the harness refuses to start instead. One tiny cell, a few cents.
// The same cell also proves the plugin under test is THIS checkout's copy: the `init` line of the
// stream names the loaded plugins, agents, skills and commands, so `praxis:spec-writer`,
// `praxis:factory` and `/praxis:feature` must be in it before a cell is worth running.
export async function preflight() {
  const dir = mkdtempSync(join(tmpdir(), "cycle-preflight-"));
  const home = isolatedHome(dir);
  const plugin = pluginCopy("preflight", home);
  const pluginReal = realpathSync(plugin);
  const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}`, CYCLE_GH_LOG: join(dir, "gh.log") };
  for (const k of ["PRAXIS_FLOOR", "PRAXIS_COMMENTS", "CLAUDE_PROJECT_DIR", "PLUGIN_DATA"]) delete env[k];
  const r = spawnSync(process.env.CLAUDE_BIN ?? "claude", [
    "-p", "Run exactly `command -v gh && gh --version` with the Bash tool and reply with its output verbatim, nothing else.",
    "--plugin-dir", plugin, "--setting-sources", "project,local", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--max-budget-usd", "0.5", "--allowedTools", "Bash(command:*)", "Bash(gh:*)",
  ], { cwd: dir, env, encoding: "utf8", timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
  rmSync(plugin, { recursive: true, force: true });
  writeFileSync(join(dir, "preflight.jsonl"), r.stdout ?? "");
  const lines = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = lines.find((l) => l.type === "system" && l.subtype === "init") ?? {};
  const result = lines.find((l) => l.type === "result");
  const out = typeof result?.result === "string" ? result.result : "";
  const logged = existsSync(join(dir, "gh.log")) && /--version/.test(readFileSync(join(dir, "gh.log"), "utf8"));
  const checks = [
    ["plugin praxis loaded from this checkout's copy", (init.plugins ?? []).some((p) => p.name === "praxis" && [plugin, pluginReal].includes(p.path))],
    ["agent praxis:spec-writer visible", (init.agents ?? []).includes("praxis:spec-writer")],
    ["skill praxis:factory visible", (init.skills ?? []).includes("praxis:factory")],
    ["command /praxis:feature visible", (init.slash_commands ?? []).includes("praxis:feature")],
    [`gh inside claude -p is the stub (logged: ${logged}; reply: ${out.replace(/\s+/g, " ").slice(0, 80)})`, logged && /0\.0\.0-stub/.test(out)],
  ];
  for (const [name, ok] of checks) console.log(`preflight ${ok ? "ok  " : "FAIL"} ${name}`);
  const info = { claudeVersion: init.claude_code_version ?? null, model: init.model ?? null, cost: result?.total_cost_usd ?? 0, transcript: join(dir, "preflight.jsonl") };
  console.log(`preflight claude ${info.claudeVersion ?? "?"} · model ${info.model ?? "?"} · $${info.cost.toFixed(3)} · ${info.transcript}`);
  if (!checks.every(([, ok]) => ok)) throw new Error(`preflight failed — refusing to spend. gh must resolve to ${BIN}/gh inside the host's shell (profile PATH order), and the plugin copy must load. --no-preflight records cells anyway, knowing what will fail for the harness's reason.`);
  return info;
}

export async function runCell(runDir, cellName, opts) {
  const cellDir = join(runDir, cellName);
  mkdirSync(cellDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const { project, projectReal, origin } = seedProject(cellName);
  const home = isolatedHome(cellDir);
  const plugin = opts.arm === "baseline" ? null : pluginCopy(cellName, home);
  const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}`, CYCLE_GH_LOG: join(cellDir, "gh.log"), PRAXIS_HOOK_TRACE: join(cellDir, "hooks.trace") };
  for (const k of ["PRAXIS_FLOOR", "PRAXIS_COMMENTS", "CLAUDE_PROJECT_DIR", "PLUGIN_DATA"]) delete env[k];
  if (opts.dryRun) env.CYCLE_STUB_SCENARIO = opts.scenario;
  writeFileSync(join(cellDir, "gh.log"), "");
  writeFileSync(join(cellDir, "hooks.trace"), "");
  const bin = opts.dryRun ? STUB : (process.env.CLAUDE_BIN ?? "claude");
  const timeoutMs = opts.timeoutMin * 60_000;
  const meta = { cell: cellName, arm: opts.arm, dryRun: !!opts.dryRun, scenario: opts.dryRun ? opts.scenario : null, startedAt, project, projectReal, origin, home, plugin, pluginSource: PLUGIN_SRC, pluginCommit: pluginCommit(), budgetUsd: opts.budgetUsd, timeoutMin: opts.timeoutMin, request: REQUEST, legs: [], approve: null, change: null, stopReason: null };
  console.log(`\n▶ ${cellName} (${opts.arm}${opts.dryRun ? `, dry-run ${opts.scenario}` : ""})  project ${project}`);

  // Plain quotes: REQUEST carries no literal `"`, and JSON.stringify would hand the model `\\n`.
  const prompt1 = opts.arm === "baseline" ? REQUEST : `/praxis:feature "${REQUEST}"`;
  const leg1 = await runLeg(cellDir, 1, { bin, prompt: prompt1, plugin, budgetUsd: opts.budgetUsd, timeoutMs, env, cwd: project });
  meta.legs.push(leg1);
  if (opts.arm === "baseline") {
    meta.stopReason = leg1.spawnError ? "spawn-error" : leg1.timedOut ? "timeout" : null;
  } else {
    const finalText = lastResultText(cellDir);
    const after = afterLeg1({ project, leg1, budgetUsd: opts.budgetUsd, timeoutMs, finalText });
    Object.assign(meta, { change: after.change, specPath: after.specPath, openQuestions: after.openQuestions, specReady: after.ready, stopReason: after.stopReason });
    if (!after.stopReason && leg1.result?.sessionId) {
      meta.approve = approve(cellDir, { plugin, project, change: after.change, env });
      if (meta.approve.exit !== 0) meta.stopReason = "approve-refused";
      else {
        const prompt2 = `Approved: .praxis/approved/${after.change} now exists — I ran /praxis:approve ${after.change}. Continue the change.`;
        const leg2 = await runLeg(cellDir, 2, { bin, prompt: prompt2, resume: leg1.result.sessionId, plugin, budgetUsd: +(opts.budgetUsd - (leg1.result?.cost ?? 0)).toFixed(2), timeoutMs: timeoutMs - leg1.wallMs, env, cwd: project });
        meta.legs.push(leg2);
        if (leg2.timedOut) meta.stopReason = "timeout";
        else if (leg2.spawnError) meta.stopReason = "spawn-error";
      }
    } else if (!after.stopReason) meta.stopReason = "no-session-id";
    driverLine(cellDir, { event: "stop", reason: meta.stopReason, change: meta.change });
  }
  Object.assign(meta, snapshot(cellDir, { project, origin, change: meta.change }));
  meta.wallMs = meta.legs.reduce((a, l) => a + l.wallMs, 0);
  meta.endedAt = new Date().toISOString();
  writeFileSync(join(cellDir, "cell.json"), JSON.stringify(meta, null, 2));
  if (plugin) rmSync(plugin, { recursive: true, force: true });
  // A live cell's repo (its branch, its worktree) stays in tmp for forensics; a dry run's is noise.
  if (opts.dryRun) rmSync(dirname(project), { recursive: true, force: true });
  return scoreCell(cellDir);
}

const lastResultText = (cellDir) => {
  const lines = readFileSync(join(cellDir, "transcript.jsonl"), "utf8").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{"type":"result"')) continue;
    try { const r = JSON.parse(lines[i]); return typeof r.result === "string" ? r.result : ""; } catch { return ""; }
  }
  return "";
};

// ── a whole run ────────────────────────────────────────────────────────────────────────────────
export function summarize(runDir, results, extra = {}) {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const tokens = (arm) => mean(results.filter((r) => r.arm === arm && r.cost.state === "PASS").map((r) => r.cost.tokensTotal));
  const comparison = compareWithMatriz({ taskClass: TASK_CLASS, cycleTokens: tokens("cycle"), baselineTokens: tokens("baseline") });
  const rows = Object.fromEntries(SCORERS.map(([k]) => [k, Object.fromEntries(["PASS", "FAIL", "SKIP", "GAP"].map((s) => [s, results.filter((r) => r.arm === "cycle" && r.scorers[k]?.state === s).length]))]));
  const summary = { runDir, generated: new Date().toISOString(), ...extra, cells: results.length, totalCost: results.reduce((a, r) => a + (r.cost.cost ?? 0), 0), rows, comparison, results: results.map(({ timeline, ...r }) => r) };
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}

const print = (summary, results) => {
  console.log(`\n${renderTable(results)}`);
  console.log(`\nEAG rows (cycle cells, PASS/FAIL/SKIP/GAP):`);
  for (const [k, v] of Object.entries(summary.rows)) console.log(`  ${k.padEnd(20)} ${v.PASS}/${v.FAIL}/${v.SKIP}/${v.GAP}`);
  const c = summary.comparison;
  console.log(`\ntokens vs matriz (${c.taskClass}): ${c.state}${c.reason ? ` — ${c.reason}` : ` — ratio ${c.ratio} vs praxis-full ${c.reference.ratio.toFixed(2)} (cycle ${Math.round(c.cycleTokens)} / baseline ${Math.round(c.baselineTokens)})`}`);
  console.log(`total cost: $${summary.totalCost.toFixed(2)} over ${results.length} cell(s) → ${summary.runDir}`);
};

async function main(argv) {
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const has = (k) => argv.includes(k);
  if (has("--rescore")) {
    const runDir = resolve(flag("--rescore"));
    const cells = readdirSync(runDir).filter((d) => /^(cell|baseline)-\d+$/.test(d) && existsSync(join(runDir, d, "cell.json"))).sort();
    const results = cells.map((d) => scoreCell(join(runDir, d)));
    print(summarize(runDir, results), results);
    return;
  }
  const opts = {
    n: Number(flag("--n", has("--dry-run") ? 1 : DEFAULTS.n)), budgetUsd: Number(flag("--budget-usd", DEFAULTS.budgetUsd)),
    timeoutMin: Number(flag("--timeout-min", DEFAULTS.timeoutMin)), dryRun: has("--dry-run"), scenario: flag("--scenario", DEFAULTS.scenario),
  };
  const armFlag = flag("--arm", DEFAULTS.arm);
  const arms = armFlag === "both" ? ["cycle", "baseline"] : [armFlag];
  if (!["good", "bad", "clarified"].includes(opts.scenario)) throw new Error(`unknown --scenario ${opts.scenario}`);
  const nBaseline = Number(flag("--n-baseline", opts.n));
  const preflightInfo = !opts.dryRun && !has("--no-preflight") ? await preflight() : null;
  const runDir = join(RUNS, `${opts.dryRun ? "dry-" : ""}${stamp()}`);
  mkdirSync(runDir, { recursive: true });
  const results = [];
  for (const arm of arms) for (let i = 1; i <= (arm === "baseline" ? nBaseline : opts.n); i++) results.push(await runCell(runDir, `${arm === "baseline" ? "baseline" : "cell"}-${i}`, { ...opts, arm }));
  print(summarize(runDir, results, { preflight: preflightInfo, plugin: { source: PLUGIN_SRC, commit: pluginCommit() }, options: { ...opts, arms, nBaseline } }), results);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
}
