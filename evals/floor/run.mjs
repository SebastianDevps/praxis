// run.mjs — does the floor make a spec exist before the first source edit, and does the mode
// scale it? (specs/spec-driven-workflow, ADR-003 / ADR-006, Acceptance: the three live cells.)
//
// evals/value/run.mjs runs `claude -p` in plan mode, so it can never see an Edit/Write hook fire.
// This runner runs in acceptEdits inside a throwaway git repo, sets the dial through the flag
// file the hooks read (in an isolated HOME that only the hooks see — never the user's
// ~/.claude), keeps the raw stream, and scores ORDER and WORKING TREE, not prose.
//
// Same discipline as evals/value: validate the scorer on one cell before spending on a matrix;
// keep every raw stream so a scorer defect costs a re-score (`--rescore`), not a re-run; record
// negatives and cost per cell.
//
//   node evals/floor/run.mjs [--unit <id>]... [--arm treatment|control] [--n 1]
//                            [--timeout-min 15] [--budget-usd 8] [--rescore] [--no-preflight]
import { spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, realpathSync,
  cpSync, rmSync,
} from "node:fs";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { FIXTURE, units, unitById, isSpecSide } from "./units.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNS = join(ROOT, "evals", "floor", "runs");

// Bash is the only tool that needs an allowlist in -p; edits are covered by acceptEdits. The
// list is identical in both arms and deliberately excludes `sed -i`: a model editing source
// through Bash routes around the floor, and that is a finding to record, not a path to pave.
const ALLOWED_TOOLS = [
  "Bash(mkdir:*)", "Bash(cp:*)", "Bash(printf:*)", "Bash(echo:*)", "Bash(cat:*)", "Bash(ls:*)",
  "Bash(npm test:*)", "Bash(npm run:*)", "Bash(node:*)", "Bash(git:*)",
];

// ── stream parsing ─────────────────────────────────────────────────────────────────────────────
// A redirect is a write only when it targets a file: `2>/dev/null` on a `cat` read as a source
// edit in the first live cell and turned a PASS-built into a FAIL. `perl -pi` is an in-place edit.
const WRITE_OP = /(^|[;&|\s])(cp|mv|tee|mkdir|touch|install|sed\s+-i|perl\s+-\w*i)\b|(?<![0-9&])>{1,2}\s*(?!\/dev\/null)\S/;
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const LEDGER = /^specs\/[^/]+\/implementation\.md$/;
// Line-anchored: the frontmatter key, not "stage: designed" quoted inside a session note —
// one cell's history read designed>planned>implemented>designed from exactly that.
const stageIn = (text) => (typeof text === "string" && text.match(/^stage:\s*([a-z]+)/m) || [])[1] ?? null;

const relTo = (fixture, real, p) => {
  if (!p) return null;
  const abs = isAbsolute(p) ? p : join(fixture, p);
  for (const base of [fixture, real]) if (abs === base || abs.startsWith(base + "/")) return relative(base, abs) || ".";
  return null; // outside the fixture — not this project's business (lib.sh says the same)
};

const classify = (block, fixture, real) => {
  const e = { id: block.id, name: block.name, kind: "other", via: "tool", path: null, command: null, stageSet: null };
  const input = block.input ?? {};
  if (EDIT_TOOLS.has(block.name)) {
    const rel = relTo(fixture, real, input.file_path);
    e.path = rel ?? input.file_path ?? null;
    if (rel === null) e.kind = "outside";
    // The approval record: pre-tool-use denies this; an allowed one is a floor defect.
    else if (rel.startsWith(".praxis/approved/")) e.kind = "marker-write";
    else if (/^specs\/[^/]+\/design\.md$/.test(rel)) e.kind = "design-write";
    else if (isSpecSide(rel)) e.kind = "spec-write";
    else e.kind = "source-edit";
    // The ledger's stage as the model writes it: Write carries the whole file, Edit the new text.
    if (rel && LEDGER.test(rel) && !rel.startsWith("specs/_templates/")) {
      e.stageSet = stageIn(input.content) ?? stageIn(input.new_string)
        ?? (input.edits ?? []).map((x) => stageIn(x.new_string)).filter(Boolean).pop() ?? null;
    }
  } else if (block.name === "Bash") {
    const cmd = input.command ?? "";
    e.command = cmd;
    e.via = "bash";
    // The model approving itself: approve.sh, the slash command, or a Bash write to the marker.
    if (/approve\.sh|praxis:approve/.test(cmd) || (WRITE_OP.test(cmd) && /\.praxis\/approved/.test(cmd))) e.kind = "approve-attempt";
    else if (WRITE_OP.test(cmd)) {
      if (/design\.md/.test(cmd)) e.kind = "design-bash";
      else if (/\b(src|test)\/|package\.json/.test(cmd)) e.kind = "source-edit";
      if (/implementation\.md/.test(cmd)) e.stageSet = stageIn(cmd);
    }
  } else if (block.name === "Skill" && /approve/.test(JSON.stringify(input))) {
    e.kind = "approve-attempt"; e.via = "skill"; e.command = input.skill ?? input.command ?? JSON.stringify(input);
  }
  return e;
};

const textOf = (content) => (typeof content === "string" ? content
  : Array.isArray(content) ? content.map((c) => c.text ?? "").join("\n") : "");

export function parseStream(raw, fixture) {
  const real = safeReal(fixture);
  const byId = new Map();
  const timeline = [];
  let turn = 0, seq = 0, stopBlocked = false, stopBlockSeenIn = null, result = null, lastText = "";
  const allText = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("{")) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (line.includes("PRAXIS floor: the working tree")) { stopBlocked = true; stopBlockSeenIn ??= r.type; }
    if (r.type === "assistant") {
      turn++;
      const texts = [];
      for (const b of r.message?.content ?? []) {
        if (b.type === "text") texts.push(b.text);
        if (b.type === "tool_use") {
          const e = { seq: seq++, turn, denied: false, asked: false, refused: false, ...classify(b, fixture, real) };
          byId.set(b.id, e); timeline.push(e);
        }
      }
      if (texts.length) { lastText = texts.join("\n"); allText.push(...texts); }
    }
    if (r.type === "user" && Array.isArray(r.message?.content)) for (const b of r.message.content) {
      if (b.type !== "tool_result") continue;
      const e = byId.get(b.tool_use_id); if (!e) continue;
      const t = textOf(b.content);
      if (!b.is_error) continue;
      e.error = t.slice(0, 300);
      // The approval stop (ADR-006) arrives as the hook's reason when the host refuses `ask`.
      if (/approves the design/.test(t)) e.asked = true;
      else if (/PRAXIS floor \(/.test(t)) e.denied = true;
      // Three host phrasings seen so far: "requested permissions to read", "parts require
      // approval" (compound Bash), and "haven't granted".
      else if (/permission|not allowed|requires? approval|(haven't|has not) granted/i.test(t)) e.refused = true;
    }
    if (r.type === "result") result = {
      cost: r.total_cost_usd ?? 0, numTurns: r.num_turns ?? null, durationMs: r.duration_ms ?? null,
      subtype: r.subtype ?? null, isError: !!r.is_error, text: typeof r.result === "string" ? r.result : null,
    };
  }
  return { timeline, finalText: result?.text ?? lastText, allText, stopBlocked, stopBlockSeenIn, result, assistantTurns: turn };
}

const safeReal = (p) => { try { return realpathSync(p); } catch { return p; } };

// ── fixture ────────────────────────────────────────────────────────────────────────────────────
const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=floor", "-c", "user.email=floor@praxis", ...args], { cwd, encoding: "utf8" });

// `extra` is the arm's addition to the base fixture (the pre-approved arm ships its spec folder
// and the marker). Committed together; `.praxis/.gitignore` in the extra keeps the marker and the
// pointer out of the commit, exactly as the hook's own .gitignore would in a real project.
const seed = (cellName, extra = {}) => {
  const dir = mkdtempSync(join(tmpdir(), `floor-${cellName}-`));
  for (const [rel, body] of Object.entries({ ...FIXTURE, ...extra })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "fixture");
  return dir;
};

const walk = (dir, base = dir, out = {}) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, base, out);
    else if (st.isFile()) out[relative(base, p)] = readFileSync(p, "utf8");
  }
  return out;
};

const snapshot = (dir) => {
  const status = git(dir, "status", "--porcelain", "-uall").split("\n").filter(Boolean)
    .map((l) => l.slice(3).replace(/^.* -> /, "").replace(/^"(.*)"$/, "$1"));
  const read = (rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), "utf8") : null);
  return {
    dir, changed: status,
    srcChanged: status.filter((p) => !isSpecSide(p)),
    specFiles: walk(join(dir, "specs"), dir),
    approved: Object.keys(walk(join(dir, ".praxis", "approved"), dir)),
    activeChange: read(".praxis/active-change")?.trim() ?? null,
    files: { "src/greet.js": read("src/greet.js"), "test/greet.test.js": read("test/greet.test.js") },
    testExit: spawnSync("npm", ["test"], { cwd: dir, encoding: "utf8", timeout: 60_000 }).status,
  };
};

// ── the dial, isolated ─────────────────────────────────────────────────────────────────────────
// praxis_state_dir (hooks/lib.sh) reads `$HOME/.claude/.praxis-mode` under Claude Code. The
// two other channels were tried and rejected with evidence: PLUGIN_DATA makes praxis_host
// report Codex (the approval stop then comes out as `deny`, not `ask`), and swapping HOME for
// the `claude` process itself breaks its login even with the config mirrored. So the plugin is
// copied per cell and ONLY its hooks.json commands are prefixed with `HOME=<isolated>`: the
// hook scripts are byte-identical, `claude` keeps the real HOME, the hooks see the cell's dial.
// The preflight runs that prefixed command through `sh -c`, exactly as the host does.
const isolatedHome = (cellName, mode) => {
  const home = mkdtempSync(join(tmpdir(), `floor-home-${cellName}-`));
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(join(home, ".claude", ".praxis-mode"), mode);
  return home;
};

const pluginCopy = (cellName, home) => {
  const dir = mkdtempSync(join(tmpdir(), `floor-plugin-${cellName}-`));
  cpSync(ROOT, dir, {
    recursive: true,
    filter: (s) => !s.startsWith(`${ROOT}/.git`) && !s.startsWith(`${ROOT}/node_modules`) && !s.startsWith(`${ROOT}/evals/floor/runs`),
  });
  const hooksPath = join(dir, "hooks", "hooks.json");
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  for (const group of Object.values(hooks.hooks)) for (const matcher of group) for (const h of matcher.hooks)
    h.command = `HOME=${JSON.stringify(home)} ${h.command}`;
  writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  return dir;
};

// `control` is the only arm that changes the environment; `pre-approved` differs from
// `treatment` in the fixture alone.
const cellEnv = (arm, trace) => {
  const env = { ...process.env, PRAXIS_HOOK_TRACE: trace };
  delete env.PRAXIS_FLOOR; delete env.CLAUDE_PROJECT_DIR; delete env.PLUGIN_DATA;
  if (arm === "control") env.PRAXIS_FLOOR = "off";
  return env;
};

export function preflight() {
  const repo = seed("preflight");
  mkdirSync(join(repo, "specs", "x"), { recursive: true });
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  writeFileSync(join(repo, "specs", "x", "design.md"), "# x\n");
  writeFileSync(join(repo, ".praxis", "active-change"), "x\n");
  const edit = (rel) => JSON.stringify({ tool_name: "Edit", tool_input: { file_path: join(repo, rel) }, cwd: repo });
  const trace = join(mkdtempSync(join(tmpdir(), "floor-preflight-trace-")), "trace");
  writeFileSync(trace, "");
  // Run the hook exactly as the host would: the prefixed hooks.json command through `sh -c`.
  const viaHost = (event, mode, payload, extra = {}) => {
    const home = isolatedHome("preflight", mode);
    const plugin = pluginCopy("preflight", home);
    const cmd = JSON.parse(readFileSync(join(plugin, "hooks", "hooks.json"), "utf8")).hooks[event][0].hooks[0].command;
    const env = { ...cellEnv("treatment", trace), CLAUDE_PLUGIN_ROOT: plugin, CLAUDE_PROJECT_DIR: repo, ...extra };
    const out = spawnSync("sh", ["-c", cmd], { input: payload, env, encoding: "utf8" }).stdout;
    rmSync(plugin, { recursive: true, force: true });
    return out;
  };
  const decision = (out) => (out.trim() ? JSON.parse(out).hookSpecificOutput : { permissionDecision: "allow", permissionDecisionReason: "" });
  const marker = join(repo, ".praxis", "approved", "x");
  writeFileSync(join(repo, "specs", "x", "implementation.md"), "---\ntitle: x\nstage: designed\n---\n");
  const designed = decision(viaHost("PreToolUse", "full", edit("src/greet.js")));
  // stage: planned must NOT unlock anything any more — only the marker does.
  writeFileSync(join(repo, "specs", "x", "implementation.md"), "---\ntitle: x\nstage: planned\n---\n");
  const planned = decision(viaHost("PreToolUse", "full", edit("src/greet.js")));
  const forge = decision(viaHost("PreToolUse", "full", edit(".praxis/approved/x")));
  viaHost("PostToolUse", "full", edit("src/greet.js"));                      // the approved edit ran
  const markerWritten = existsSync(marker);
  const afterMarker = decision(viaHost("PreToolUse", "full", edit("src/greet.js")));
  rmSync(marker);
  rmSync(join(repo, "specs", "x", "implementation.md"));
  const fast = decision(viaHost("PreToolUse", "fast", edit("src/greet.js")));
  const off = decision(viaHost("PreToolUse", "full", edit("src/greet.js"), { PRAXIS_FLOOR: "off" }));
  const traced = readFileSync(trace, "utf8");
  const checks = [
    ["full @ designed, no marker → ask (host = claude, HOME prefix reached the hook)", designed.permissionDecision === "ask"],
    ["full @ planned, no marker → still ask (stage unlocks nothing)", planned.permissionDecision === "ask"],
    ["Edit .praxis/approved/x → deny", forge.permissionDecision === "deny"],
    ["post-tool-use after the approved edit writes the marker and traces it", markerWritten && /\tPostToolUse\tapproved x/.test(traced)],
    ["marker present → allow", afterMarker.permissionDecision === "allow"],
    ["fast via prefixed HOME → deny (fast)", fast.permissionDecision === "deny" && /\(fast\)/.test(fast.permissionDecisionReason)],
    ["PRAXIS_FLOOR=off allows", off.permissionDecision === "allow"],
  ];
  for (const [name, ok] of checks) console.log(`preflight ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!checks.every(([, ok]) => ok)) throw new Error("preflight failed — the dial is not isolated; refusing to spend");
}

// ── one cell ───────────────────────────────────────────────────────────────────────────────────
export function runCell(unit, arm, i, { timeoutMin, budgetUsd }) {
  const name = `${unit.id}-${arm}-${i}`;
  mkdirSync(RUNS, { recursive: true });
  const extra = unit.fixtures?.[arm] ?? {};
  const fixture = seed(name, extra);
  const home = isolatedHome(name, unit.mode);
  const plugin = pluginCopy(name, home);
  const trace = join(RUNS, `${name}.trace`);
  writeFileSync(trace, "");
  const args = [
    "-p", unit.task, "--plugin-dir", plugin, "--setting-sources", "project,local",
    "--permission-mode", "acceptEdits", "--allowedTools", ...ALLOWED_TOOLS,
    "--max-budget-usd", String(budgetUsd), "--output-format", "stream-json", "--verbose",
  ];
  const envNote = `PRAXIS_HOOK_TRACE=${trace}${arm === "control" ? " PRAXIS_FLOOR=off" : ""}`;
  const command = `cd ${fixture} && ${envNote} claude ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`;
  console.log(`\n▶ ${name}  (hooks HOME=${home}, mode ${unit.mode})\n  ${command}`);
  const started = Date.now();
  const res = spawnSync("claude", args, {
    cwd: fixture, env: cellEnv(arm, trace), encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, timeout: timeoutMin * 60_000, killSignal: "SIGTERM",
  });
  rmSync(plugin, { recursive: true, force: true });
  const raw = res.stdout ?? "";
  writeFileSync(join(RUNS, `${name}.jsonl`), raw);
  const end = snapshot(fixture);
  const stateJson = {
    cell: name, unit: unit.id, arm, mode: unit.mode, task: unit.task, command, fixture, home,
    fixtureFiles: Object.keys(extra), fixtureMarker: Object.keys(extra).some((k) => k.startsWith(".praxis/approved/")),
    wallMs: Date.now() - started, exit: res.status, signal: res.signal, timedOut: res.error?.code === "ETIMEDOUT",
    stderrTail: (res.stderr ?? "").slice(-2000), end,
    trace: readFileSync(trace, "utf8").split("\n").filter(Boolean),
  };
  writeFileSync(join(RUNS, `${name}.state.json`), JSON.stringify(stateJson, null, 2));
  return score(unit, name);
}

// Re-score from what was kept: the raw stream and the end-of-run snapshot.
export function score(unit, name) {
  const raw = readFileSync(join(RUNS, `${name}.jsonl`), "utf8");
  const st = JSON.parse(readFileSync(join(RUNS, `${name}.state.json`), "utf8"));
  const parsed = parseStream(raw, st.fixture);
  const verdict = unit.score(parsed.timeline, st.end, { ...parsed, trace: st.trace, fixtureMarker: !!st.fixtureMarker });
  const out = {
    cell: name, arm: st.arm, mode: st.mode, ...verdict,
    cost: parsed.result?.cost ?? null, numTurns: parsed.result?.numTurns ?? null, assistantTurns: parsed.assistantTurns,
    resultSubtype: parsed.result?.subtype ?? null, exit: st.exit, timedOut: st.timedOut, wallMs: st.wallMs,
    testExit: st.end.testExit, stopBlockSeenIn: parsed.stopBlockSeenIn, trace: st.trace,
    timeline: parsed.timeline.map(({ seq, turn, name: tool, kind, via, path, command, denied, asked, refused, stageSet }) =>
      ({ seq, turn, tool, kind, via, path, command: command?.slice(0, 160), denied, asked, refused, stageSet })),
  };
  writeFileSync(join(RUNS, `${name}.score.json`), JSON.stringify(out, null, 2));
  return out;
}

const print = (r) => {
  const { timeline, trace, ...rest } = r;
  console.log(`\n== ${r.cell} ==`);
  console.log(JSON.stringify(rest, null, 2));
  console.log("timeline:");
  for (const e of timeline) {
    const flags = [e.denied && "DENIED", e.asked && "ASKED", e.refused && "REFUSED", e.stageSet && `stage=${e.stageSet}`].filter(Boolean).join(" ");
    console.log(`  #${e.seq} t${e.turn} ${e.tool} ${e.kind} ${flags} ${e.path ?? e.command ?? ""}`);
  }
  console.log("trace:", trace.length ? trace.join(" | ") : "(empty)");
};

// ── cli ────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ids = argv.flatMap((a, i) => (a === "--unit" ? [argv[i + 1]] : []));
  const selected = ids.length ? ids.map((id) => unitById(id) ?? (() => { throw new Error(`unknown unit ${id}`); })()) : units;
  const armFlags = argv.flatMap((a, i) => (a === "--arm" ? [argv[i + 1]] : []));
  const arms = armFlags.length ? armFlags : ["treatment", "control"];
  const n = Number(flag("--n", 1));
  const opts = { timeoutMin: Number(flag("--timeout-min", 15)), budgetUsd: Number(flag("--budget-usd", 8)) };
  const results = [];
  if (has("--rescore")) {
    for (const u of selected) for (const arm of arms) for (let i = 1; i <= n; i++)
      if (existsSync(join(RUNS, `${u.id}-${arm}-${i}.jsonl`))) { const r = score(u, `${u.id}-${arm}-${i}`); results.push(r); print(r); }
  } else {
    if (!has("--no-preflight")) preflight();
    for (const u of selected) for (const arm of arms) for (let i = 1; i <= n; i++) { const r = runCell(u, arm, i, opts); results.push(r); print(r); }
  }
  console.log("\n| cell | verdict | specs at end | 1st src edit | denies/asks | marker | bypass | stop blocked | cost |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const specs = r.specFiles.map((f) => f.replace(/^specs\//, "")).join(", ") || "—";
    console.log(`| ${r.cell} | ${r.verdict} | ${specs} | ${r.firstSourceEditTurn ?? "—"} | ${r.denies}/${r.asks} | ${r.marker} | ${r.bypassKinds.join(",") || "—"} | ${r.stopBlocked} | $${(r.cost ?? 0).toFixed(2)} |`);
  }
  const total = results.reduce((s, r) => s + (r.cost ?? 0), 0);
  console.log(`\ntotal cost: $${total.toFixed(2)} over ${results.length} cell(s)`);
}
