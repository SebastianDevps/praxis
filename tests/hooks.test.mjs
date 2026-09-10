// Hook behavior. These cover the injection path added for per-turn and
// per-subagent context: two real bugs surfaced here during development (Codex
// falling through to the flat Copilot shape, which Codex drops silently, and
// grep leaking "brackets not balanced" to stderr on every spawn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, accessSync, constants, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CLEAN = { PATH: process.env.PATH, HOME: process.env.HOME };

function run(hook, { env = {}, input = "" } = {}) {
  const res = execFileSync("bash", [join(ROOT, "hooks", hook)], {
    env: { ...CLEAN, ...env },
    input,
    encoding: "utf8",
    timeout: 10_000,
  });
  return res;
}

const claude = (hook, opts = {}) =>
  run(hook, { ...opts, env: { CLAUDE_PLUGIN_ROOT: ROOT, ...(opts.env ?? {}) } });

function context(stdout) {
  const parsed = JSON.parse(stdout); // throws on the invalid-JSON regression
  const inner = parsed.hookSpecificOutput ?? parsed;
  return inner.additionalContext ?? inner.additional_context ?? "";
}

const craftsIn = (ctx) =>
  ctx.split("\n").filter((l) => l.startsWith("## Craft — ")).map((l) => l.replace("## Craft — ", ""));

test("session-start emits valid JSON carrying the router", () => {
  const ctx = context(claude("session-start"));
  assert.match(ctx, /using-praxis/);
  assert.ok(ctx.length > 1000);
});

test("user-prompt-submit injects the orchestrator contract every turn", () => {
  const ctx = context(claude("user-prompt-submit"));
  assert.match(ctx, /RUN CARD/, "orchestrator variant must keep the Run Card");
  assert.match(ctx, /ladder/);
});

test("subagent-start strips orchestrator-only sections", () => {
  const ctx = context(claude("subagent-start"));
  assert.doesNotMatch(ctx, /RUN CARD/, "a specialist must not be told to render Run Cards");
  assert.match(ctx, /ladder/, "but it keeps the universal discipline");
});

// Membership plus a separately pinned count — never an exhaustive equality. This trap has now been
// sprung twice. The first author pinned declaration order; the second sorted the list, which killed
// the order dependency and left the equality intact, so the next craft added to any of these agents
// re-armed it. Both times the red said "the wiring is broken" about correct work, which is the
// failure mode `evidence-discipline` names.
//
// Under this shape a new craft fails exactly one assertion — the count — and that red reads as "a
// craft was added, confirm the number", which is true. The membership loop keeps saying the thing
// that actually matters: this agent still carries the crafts it must carry. Do not "simplify" the
// two back into one deepEqual; the equality is the trap, not the tidiness.
test("subagent-start resolves the dispatched agent's declared crafts", () => {
  const design = craftsIn(context(claude("subagent-start", { input: '{"agent_type":"praxis:design"}' })));
  for (const craft of ["anti-slop", "a11y-baseline", "motion-discipline"]) {
    assert.ok(design.includes(craft), `design lost the ${craft} craft — got ${design}`);
  }
  assert.equal(design.length, 3, `design's craft count moved — confirm the number: ${design}`);

  const engineer = craftsIn(context(claude("subagent-start", { input: '{"agent_type":"engineer"}' })));
  for (const craft of ["minimalism", "evidence-discipline"]) {
    assert.ok(engineer.includes(craft), `engineer lost the ${craft} craft — got ${engineer}`);
  }
  assert.equal(engineer.length, 2, `engineer's craft count moved — confirm the number: ${engineer}`);
});

test("an unknown or stock agent still receives the contract", () => {
  const ctx = context(claude("subagent-start", { input: '{"agent_type":"Explore"}' }));
  assert.deepEqual(craftsIn(ctx), []);
  assert.match(ctx, /ladder/);
});

test("a host-supplied agent_type cannot traverse out of agents/", () => {
  // "../agents/design" is the discriminating payload: without the guard it
  // resolves to a real file and yields that agent's crafts, so a vacuous test would
  // pass here. Paths that simply do not exist prove nothing.
  for (const evil of ["../agents/design", "../../etc/passwd", "agents/../design", ".."]) {
    const ctx = context(claude("subagent-start", { input: JSON.stringify({ agent_type: evil }) }));
    assert.deepEqual(craftsIn(ctx), [], `traversal not rejected: ${evil}`);
  }
});

test("PRAXIS_SUBAGENT_MATCHER scopes injection, and only on a definite mismatch", () => {
  const env = { PRAXIS_SUBAGENT_MATCHER: "design|engineer" };
  assert.match(
    context(claude("subagent-start", { env, input: '{"agent_type":"engineer"}' })),
    /ladder/,
  );
  assert.equal(
    claude("subagent-start", { env, input: '{"agent_type":"researcher"}' }).trim(),
    "",
    "a match failure must skip injection entirely",
  );
});

test("a bad matcher regex fails open, quietly", () => {
  const out = claude("subagent-start", {
    env: { PRAXIS_SUBAGENT_MATCHER: "[" },
    input: '{"agent_type":"praxis:design"}',
  });
  // Membership, not a count: this test's subject is fail-open, not the craft list. A skipped
  // injection yields an empty array and goes red, which is the whole discrimination it needs —
  // and it stops a craft added to `design` from failing a test that is not about `design`.
  const crafts = craftsIn(context(out));
  assert.ok(crafts.includes("anti-slop"), `an unusable regex must not drop the method — got ${crafts}`);
});

test("a stalled payload fails open instead of hanging the spawn", () => {
  const started = Date.now();
  const ctx = context(claude("subagent-start", { env: { PRAXIS_SUBAGENT_MATCHER: "design" } }));
  assert.match(ctx, /ladder/);
  assert.ok(Date.now() - started < 5000, "stdin read must stay bounded");
});

test("each host receives the dialect it actually consumes", () => {
  // Codex exposes PLUGIN_ROOT and no CLAUDE_PLUGIN_ROOT; it reads the nested form.
  const codex = JSON.parse(run("user-prompt-submit", { env: { PLUGIN_ROOT: ROOT } }));
  assert.ok(codex.hookSpecificOutput?.additionalContext, "Codex needs the nested shape");

  const cursor = JSON.parse(run("user-prompt-submit", { env: { CURSOR_PLUGIN_ROOT: ROOT } }));
  assert.ok(cursor.additional_context, "Cursor reads a flat additional_context");

  const copilot = JSON.parse(run("user-prompt-submit", { env: { COPILOT_CLI: "1" } }));
  assert.ok(copilot.additionalContext, "Copilot reads a flat additionalContext");
});

// A malformed hooks.json, or a command pointing at a file that was renamed,
// disables the whole priming layer silently — the plugin loads and simply
// never injects anything.
test("every host hook config is valid JSON and points at an executable script", () => {
  for (const config of ["hooks/hooks.json", "hooks/hooks-codex.json", "hooks/hooks-cursor.json"]) {
    const raw = readFileSync(join(ROOT, config), "utf8");
    const parsed = JSON.parse(raw);
    const commands = JSON.stringify(parsed).match(/hooks\/[a-z-]+(?:\.cmd)?/g) ?? [];
    assert.ok(commands.length > 0, `${config} registers no hook command`);
    for (const rel of new Set(commands)) {
      const path = join(ROOT, rel);
      assert.doesNotThrow(() => accessSync(path, constants.X_OK), `${config} → ${rel} missing or not executable`);
    }
    // run-hook.cmd takes the real script as its argument; check those too.
    for (const name of JSON.stringify(parsed).match(/run-hook\.cmd\\" ([a-z-]+)/g) ?? []) {
      const script = name.split(" ")[1];
      assert.doesNotThrow(() => accessSync(join(ROOT, "hooks", script), constants.X_OK), `missing hook script: ${script}`);
    }
  }
});

// The intensity dial. Its whole value is determinism — a Markdown command is
// read by the model and followed most of the time; a flag file is read by the
// hook and applied every time. That only holds if the switch actually persists.
const withHome = (input, env = {}) => {
  const home = mkdtempSync(join(tmpdir(), "praxis-mode-"));
  const call = (payload) =>
    run("user-prompt-submit", {
      input: JSON.stringify({ prompt: payload }),
      env: { CLAUDE_PLUGIN_ROOT: ROOT, HOME: home, ...env },
    });
  return { call, first: call(input) };
};

test("the dial defaults to full and states the active level every turn", () => {
  const { first } = withHome("fix the typo");
  const ctx = context(first);
  assert.match(ctx, /active mode: full/);
  assert.match(ctx, /RUN CARD/);
});

test("a mode switch persists to the next turn", () => {
  const { call } = withHome("noop");
  assert.match(context(call("/praxis fast")), /MODE CHANGED — fast/);
  const next = context(call("now fix the bug"));
  assert.match(next, /active mode: fast/, "the level must outlive the turn that set it");
  assert.doesNotMatch(next, /RUN CARD/, "fast drops the ceremony");
  assert.match(next, /Fast mode/);
});

test("/praxis:mode deep adds the deep-only discipline", () => {
  const { call } = withHome("noop");
  call("/praxis:mode deep");
  const ctx = context(call("design the schema"));
  assert.match(ctx, /active mode: deep/);
  assert.match(ctx, /Deep mode/);
  assert.match(ctx, /RUN CARD/, "deep keeps everything full has");
});

test("an unrecognized level is ignored rather than applied", () => {
  const { call } = withHome("noop");
  call("/praxis deep");
  const ctx = context(call("/praxis banana"));
  assert.match(ctx, /active mode: deep/, "a bad argument must not silently change the level");
});

test("the dial changes ceremony, never the crafts or the safety carve-outs", () => {
  const { call } = withHome("noop");
  call("/praxis fast");
  const ctx = context(call("ship it"));
  for (const kept of [/ladder/, /trust boundaries/, /accessibility/, /anti-slop/]) {
    assert.match(ctx, kept, "fast mode must not trim discipline");
  }
});

// The approval handshake. `full` and `deep` stop when the shape of the work is unclear; `fast`
// has no ledger to gate, so it has nothing to stop for. The three tests below pin the parts of
// that contract that a well-meaning edit would quietly undo.
test("the approval handshake reaches full and deep, and never fast", () => {
  const { first } = withHome("build the thing");
  assert.match(context(first), /Needs your decision/, "full lost the halt state");

  const deep = withHome("noop");
  deep.call("/praxis:mode deep");
  assert.match(context(deep.call("design the schema")), /Needs your decision/, "deep lost the halt state");

  const fast = withHome("noop");
  fast.call("/praxis fast");
  assert.doesNotMatch(
    context(fast.call("rename it")),
    /Needs your decision/,
    "fast has no ledger to gate — offering to stop for approval is ceremony it exists to drop",
  );
});

test("no mode tells the agent to escalate ambiguity into ceremony", () => {
  // The line this replaces — "When unsure, treat it as substantial" — was injected unconditionally,
  // so `fast` received both it and "the person driving has classified this as small". Ambiguity
  // belongs in a question to the user, not in a heavier process chosen without them.
  for (const level of ["fast", "full", "deep"]) {
    const { call } = withHome("noop");
    call(`/praxis ${level}`);
    const ctx = context(call("do the thing"));
    assert.doesNotMatch(ctx, /treat it as substantial/, `${level} still escalates ambiguity into ceremony`);
    assert.match(ctx, /ask ONE question and\s+STOP/, `${level} lost the clarify rule that replaced it`);
  }
});

test("a question is answerable at every level without entering the process", () => {
  for (const level of ["fast", "full", "deep"]) {
    const { call } = withHome("noop");
    call(`/praxis ${level}`);
    assert.match(
      context(call("how does routing work here?")),
      /Answer first/,
      `${level} has no exit for a question — the dial scales ceremony, and a question has none`,
    );
  }

  // …and it is orchestrator-only. A dispatched specialist receives a task, never a bare question,
  // so the line would be paid for on every dispatch and usable on none.
  assert.doesNotMatch(
    context(claude("subagent-start", { input: '{"agent_type":"engineer"}' })),
    /Answer first/,
    "a specialist is dispatched with work, not with a question — this line is dead weight there",
  );
});

test("a dispatched specialist inherits the active level", () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-mode-"));
  const env = { CLAUDE_PLUGIN_ROOT: ROOT, HOME: home };
  run("user-prompt-submit", { input: '{"prompt":"/praxis deep"}', env });
  const ctx = context(run("subagent-start", { input: '{"agent_type":"engineer"}', env }));
  assert.match(ctx, /active mode: deep/, "the dial must travel with the dispatch");
  assert.match(ctx, /Deep mode/);
  assert.doesNotMatch(ctx, /RUN CARD/, "a specialist still never renders Run Cards");
});

// A SessionStart matcher that omits a session type means every session of that
// type runs unprimed. The Claude config omitted `resume` while the Codex sibling
// included it, and the activation report showed most real sessions that used a
// Praxis resource had never been primed.
test("every host primes the same session types", () => {
  const matchers = ["hooks/hooks.json", "hooks/hooks-codex.json"].map((f) => {
    const cfg = JSON.parse(readFileSync(join(ROOT, f), "utf8"));
    return [f, cfg.hooks.SessionStart[0].matcher];
  });
  for (const [file, matcher] of matchers) {
    for (const kind of ["startup", "resume", "clear", "compact"]) {
      assert.ok(matcher.includes(kind), `${file} never primes on "${kind}"`);
    }
  }
});

// Skills reach a specialist as Level-1 pointers: name and description, never the
// body. See docs/context-delivery.md — bodies cost 4-7x here and collapse two
// levels the host already separates. The test is generic rather than keyed to a
// hand-picked phrase: every declared skill's description must arrive and its
// body's own section headings must not.
function declaredSkills(agent) {
  const fm = readFileSync(join(ROOT, "agents", `${agent}.md`), "utf8").split("---")[1] ?? "";
  const block = fm.split(/^skills:\s*$/m)[1];
  if (!block) return [];
  const out = [];
  let started = false;
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*-\s+(\S+)/);
    if (m) { out.push(m[1]); started = true; continue; }
    // The split leaves a leading empty string before the first item; only a
    // non-blank line that is not a list item ends the block.
    if (started || line.trim() !== "") break;
  }
  return out;
}
const skillParts = (skill) => {
  const raw = readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
  const [, fm = "", ...rest] = raw.split(/^---[ \t]*$/m);
  const body = rest.join("---");
  return { fm, headings: [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()) };
};

for (const agent of ["design", "orchestrator", "engineer"]) {
  test(`${agent} receives its declared skills as pointers, not bodies`, () => {
    const declared = declaredSkills(agent);
    assert.ok(declared.length > 0, `${agent} declares no skills — update this test if that is intended`);
    const ctx = context(claude("subagent-start", { input: JSON.stringify({ agent_type: `praxis:${agent}` }) }));
    // Scope the leak check to the skills section: crafts ARE injected in full and
    // legitimately share generic heading names with skills ("## Color" lives in
    // both the anti-slop craft and the data-visualization skill).
    const section = ctx.split(/^# Skills declared for/m)[1];
    assert.ok(section, `${agent} received no skills section`);

    for (const skill of declared) {
      assert.match(section, new RegExp(`\`${skill}\``), `pointer missing for ${skill}`);
      for (const heading of skillParts(skill).headings) {
        assert.ok(!section.includes(`## ${heading}`), `${skill} body leaked into the dispatch: "## ${heading}"`);
      }
    }
  });
}

test("an agent with no declaration still receives the contract", () => {
  // A stock host agent, not a Praxis one: every Praxis agent now declares skills,
  // so the undeclared case is the one that comes from outside the plugin.
  const ctx = context(claude("subagent-start", { input: '{"agent_type":"Explore"}' }));
  assert.match(ctx, /ladder/);
  assert.doesNotMatch(ctx, /Skills declared for/, "no declaration means no empty section");
});

test("the skill pointer path rejects a traversing agent_type", () => {
  const ctx = context(claude("subagent-start", { input: '{"agent_type":"../agents/design"}' }));
  assert.doesNotMatch(ctx, /Skills declared for/);
});

// ── The project's rules reach the reviewer, and nobody else ───────────────────────────────────
//
// ADR-002 (specs/mattpocock-imports): `agents/rules/*.md` and `CONSTRAINTS.md` are enforced in
// review, not paid for on every build turn. Both directions are asserted, because the cheap
// mistake is injecting for every agent — the reviewer test would still pass and the builders
// would silently carry the rules. Mutated before trusting: make the hook inject unconditionally
// and the engineer test below fails; restore the `reviewer` check and it passes.

import { spawnSync } from "node:child_process";

function rulesRepo({ rules = true, constraints = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "praxis-rules-"));
  if (rules) {
    mkdirSync(join(repo, "agents/rules"), { recursive: true });
    writeFileSync(
      join(repo, "agents/rules/quality-x.md"),
      "---\ntitle: Quality X\nimpact: HIGH\n---\n\n## Quality X\n\nRULE-BODY-SENTINEL: never inject this line.\n",
    );
    // The scaffold's own files live beside the rules and are not rules.
    writeFileSync(join(repo, "agents/rules/_sections.md"), "# Sections\n");
  }
  if (constraints) writeFileSync(join(repo, "CONSTRAINTS.md"), "# Quality bar\n\nCONSTRAINTS-BODY-SENTINEL\n");
  const dispatch = (agent) =>
    spawnSync("bash", [join(ROOT, "hooks", "subagent-start")], {
      env: { ...CLEAN, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: repo },
      input: JSON.stringify({ agent_type: agent }),
      encoding: "utf8",
      timeout: 10_000,
    });
  return { repo, dispatch };
}

test("the project's rules reach the reviewer as pointers — path and title, never the body", () => {
  const { dispatch } = rulesRepo();
  const out = dispatch("praxis:reviewer");
  const ctx = context(out.stdout);
  const section = ctx.split(/^# Project standards for/m)[1];
  assert.ok(section, "reviewer received no project-standards section");
  assert.match(section, /`agents\/rules\/quality-x\.md` — Quality X/);
  assert.match(section, /`CONSTRAINTS\.md` — Quality bar/);
  assert.doesNotMatch(section, /_sections\.md/, "the scaffold's own file is not a rule");
  for (const leak of ["RULE-BODY-SENTINEL", "CONSTRAINTS-BODY-SENTINEL"]) {
    assert.ok(!ctx.includes(leak), `a body leaked into the dispatch: ${leak}`);
  }
  assert.equal(out.stderr, "", "a clean resolution says nothing on stderr");
  // The bare name, as a host without the plugin namespace sends it.
  assert.match(context(dispatch("reviewer").stdout), /agents\/rules\/quality-x\.md/);
});

test("the project's rules never reach a builder", () => {
  const { dispatch } = rulesRepo();
  for (const builder of ["engineer", "praxis:engineer", "backend", "design", "platform", "orchestrator"]) {
    const ctx = context(dispatch(builder).stdout);
    assert.doesNotMatch(ctx, /Project standards for/, `${builder} received the rules section`);
    assert.doesNotMatch(ctx, /quality-x\.md/, `${builder} received a rule pointer`);
    // The pointer form, not the bare filename: `platform` declares `quality-bar`, whose
    // description legitimately names CONSTRAINTS.md as the file it writes.
    assert.doesNotMatch(ctx, /`CONSTRAINTS\.md` — Quality bar/, `${builder} received the constraints pointer`);
  }
});

test("a project with no rules injects nothing into the reviewer, and raises no error", () => {
  const { dispatch } = rulesRepo({ rules: false, constraints: false });
  const out = dispatch("praxis:reviewer");
  assert.equal(out.status, 0);
  assert.equal(out.stderr, "", "a project that documents nothing is a valid state, not an error");
  const ctx = context(out.stdout);
  assert.doesNotMatch(ctx, /Project standards for/, "no rules means no empty section");
  assert.match(ctx, /ladder/, "the contract still arrives");

  // CONSTRAINTS.md alone is still a standard the reviewer reads.
  const only = rulesRepo({ rules: false, constraints: true });
  assert.match(context(only.dispatch("praxis:reviewer").stdout), /`CONSTRAINTS\.md` — Quality bar/);
});

// ── subagent-stop: the memory write path ──────────────────────────────────────────────────────
//
// The hook is deliberately INERT in a project with no `.praxis/` directory. That is the property
// most likely to be mistaken for a broken hook, so it is asserted in both directions: silent where
// it should be silent, and writing where it should write.

import { mkdirSync, existsSync as fsExists, readFileSync as fsRead } from "node:fs";

const stopIn = (projectDir, input = "") =>
  execFileSync("bash", [join(ROOT, "hooks", "subagent-stop")], {
    env: { ...CLEAN, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: projectDir },
    input,
    encoding: "utf8",
    timeout: 10_000,
  });

test("subagent-stop is inert in a project with no .praxis directory", () => {
  const project = mkdtempSync(join(tmpdir(), "praxis-nostore-"));
  stopIn(project, '{"agent_type":"praxis:design"}');
  assert.ok(
    !fsExists(join(project, ".praxis")),
    "capture scaffolded a store into a project that never opted in",
  );
});

test("subagent-stop appends one pending row per dispatch", () => {
  const project = mkdtempSync(join(tmpdir(), "praxis-store-"));
  mkdirSync(join(project, ".praxis"), { recursive: true });

  stopIn(project, '{"agent_type":"praxis:design","status":"done"}');
  stopIn(project, '{"agent_type":"engineer"}');

  const lines = fsRead(join(project, ".praxis", "memory", "sessions.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l)); // throws if a row was ever written malformed

  assert.equal(lines.length, 2);
  assert.equal(lines[0].agent, "design", "the plugin namespace must be stripped");
  assert.equal(lines[0].status, "done");
  assert.equal(lines[0].state, "pending", "capture writes pending rows; consolidation consumes them");
  // A subagent that returned no status line is a real state, not a reason to invent one.
  assert.equal(lines[1].status, "unreported");
  assert.equal(lines[1].agent, "engineer");
});

test("subagent-stop refuses a traversing agent_type rather than writing it to disk", () => {
  const project = mkdtempSync(join(tmpdir(), "praxis-traverse-"));
  mkdirSync(join(project, ".praxis"), { recursive: true });

  stopIn(project, '{"agent_type":"../../etc/passwd"}');

  const row = JSON.parse(fsRead(join(project, ".praxis", "memory", "sessions.jsonl"), "utf8").trim());
  assert.equal(row.agent, "unknown", "a traversing agent_type reached the record");
});

test("subagent-stop survives a host that sends no payload at all", () => {
  const project = mkdtempSync(join(tmpdir(), "praxis-nopayload-"));
  mkdirSync(join(project, ".praxis"), { recursive: true });

  stopIn(project, "");

  const row = JSON.parse(fsRead(join(project, ".praxis", "memory", "sessions.jsonl"), "utf8").trim());
  assert.equal(row.agent, "unknown");
  assert.ok(row.ts, "the row still carries a timestamp");
});

// ── The spec floor: pre-tool-use, stop, and the per-change ledger ─────────────────────────────
//
// specs/spec-driven-workflow, ADR-003. The measured evaluation recorded 0/8 Run Cards in `full`
// mode from priming alone; a prose rule "write the spec first" would travel the same channel.
// So the floor is mechanical, and per `evidence-discipline` it is trusted only because it was
// mutated: comment out the deny in `hooks/pre-tool-use` (or the block in `hooks/stop`) and
// this section fails; restore it and this section passes. The commands and their output are
// recorded in specs/spec-driven-workflow/implementation.md under T06.

import { writeFileSync, appendFileSync, statSync } from "node:fs";
import { dirname } from "node:path";

function floorRepo({ mode = "full", git = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "praxis-floor-"));
  const home = mkdtempSync(join(tmpdir(), "praxis-floor-home-"));
  // The dial's flag file, where praxis_state_dir looks for it under Claude Code.
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(join(home, ".claude", ".praxis-mode"), mode);
  if (git) execFileSync("git", ["init", "-q"], { cwd: repo });

  const env = { CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: repo, HOME: home };
  const hook = (name, input, extra = {}) =>
    run(name, { input: JSON.stringify(input), env: { ...env, ...extra } });
  const write = (rel, text = "") => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text);
  };
  const commit = () => {
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x"], { cwd: repo });
  };
  // The person's approval, as the hooks record it: an empty marker file.
  const approve = (change) => write(`.praxis/approved/${change}`, "");
  const approved = (change) => fsExists(join(repo, ".praxis/approved", change));
  return { repo, hook, write, commit, approve, approved };
}

const ledger = (stage) => `---\ntitle: x\nstage: ${stage}     # new → designed → planned\n---\n\n## Tasks\n`;
const edit = (path) => ({ tool_name: "Edit", tool_input: { file_path: path } });
// No output is the allow: a PreToolUse hook that prints nothing changes nothing.
const decision = (out) => (out.trim() === "" ? "allow" : JSON.parse(out).hookSpecificOutput.permissionDecision);
const reason = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

test("pre-tool-use in full denies a source edit with no spec, and names both files to create", () => {
  const { repo, hook } = floorRepo({ mode: "full" });
  const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /design\.md/);
  assert.match(reason(out), /implementation\.md/);
  assert.match(reason(out), /active-change/, "the deny must say how to name the change");
  assert.match(reason(out), /PRAXIS_FLOOR=off/, "the only override is stated, not hidden");
});

test("pre-tool-use in full allows once design.md exists and the person approved it", () => {
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/x/design.md", "# x\n");
  write("specs/x/implementation.md", ledger("designed"));
  approve("x");
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow");
  // A relative path is resolved against the payload's cwd, the way hosts send it.
  assert.equal(decision(hook("pre-tool-use", { ...edit("src/a.js"), cwd: repo })), "allow");
  for (const stage of ["new", "planned", "implemented", "shipped"]) {
    write("specs/x/implementation.md", ledger(stage));
    assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow", `stage ${stage} with the marker`);
  }
});

// The approval stop. Prose ("Needs your decision") did not hold in the first live cell, and
// gating on `stage:` did not hold in the matrix: 3/3 unattended runs set `stage: planned`
// themselves after the refused ask. The host's own `ask` is the stop, and the record of the
// answer is a marker the model cannot write — `.praxis/approved/<change>`.
test("pre-tool-use in full asks while the marker is missing, whatever stage: says", () => {
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/x/design.md", "# x\n");
  for (const stage of ["new", "designed", "planned", "implemented"]) {
    write("specs/x/implementation.md", ledger(stage));
    const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
    assert.equal(decision(out), "ask", `stage ${stage} without the marker`);
    assert.match(reason(out), /Approving this edit approves the design/);
    assert.match(reason(out), /\.praxis\/approved\/x/, "the ask names the record the approval writes");
    assert.match(reason(out), /\/praxis:approve x/, "and the person's command on hosts without a prompt");
    assert.match(reason(out), /unlocks nothing/, "stage: must not read as the key");
  }
  approve("x");
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow");
});

test("the marker is not a bypass: a change whose design.md is gone is denied", () => {
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/x/implementation.md", ledger("planned"));
  approve("x");
  const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /specs\/x\/design\.md does not exist/);
});

test("pre-tool-use denies Edit/Write to the approval record itself, in every mode", () => {
  for (const mode of ["fast", "full", "deep"]) {
    const { repo, hook } = floorRepo({ mode });
    const out = hook("pre-tool-use", { tool_name: "Write", tool_input: { file_path: join(repo, ".praxis/approved/x") } });
    assert.equal(decision(out), "deny", mode);
    assert.match(reason(out), /written by the person/);
    assert.match(reason(out), /\/praxis:approve/);
  }
});

test("on Codex, where ask is parsed but not honoured, the approval stop is a deny", () => {
  // Codex exports PLUGIN_ROOT/PLUGIN_DATA (and CLAUDE_PLUGIN_ROOT for compatibility); its
  // reference says `ask` marks the hook failed and lets the tool call continue.
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/x/design.md", "# x\n");
  write("specs/x/implementation.md", ledger("designed"));
  const codex = { PLUGIN_ROOT: ROOT, PLUGIN_DATA: join(process.env.HOME, "nowhere") };
  // The dial reads PLUGIN_DATA first under Codex; point it at the fixture's mode file.
  const env = { ...codex, PLUGIN_DATA: codexData(repo) };
  const out = hook("pre-tool-use", { ...edit("src/a.js"), cwd: repo }, env);
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /Approving this edit approves the design/);
  assert.match(reason(out), /cannot ask/);
  assert.match(reason(out), /\/praxis:approve x/);
  approve("x");
  assert.equal(decision(hook("pre-tool-use", { ...edit("src/a.js"), cwd: repo }, env)), "allow");
});

// ── post-tool-use: the hook that writes the approval record ──────────────────────────────────
//
// It fires after the host let an edit through. In full/deep, at a designed change with no
// marker, the only way an edit got through is that the person answered the ask — so this is
// where the answer is recorded.

test("post-tool-use writes the marker after a source edit of a designed change", () => {
  const { repo, hook, write, approved } = floorRepo({ mode: "full" });
  write("specs/x/design.md", "# x\n");
  write("specs/x/implementation.md", ledger("designed"));
  assert.equal(hook("post-tool-use", edit(join(repo, "src/a.js"))).trim(), "", "post-tool-use never speaks");
  assert.ok(approved("x"), "the approval record was not written");
  const ignore = fsRead(join(repo, ".praxis/.gitignore"), "utf8");
  assert.match(ignore, /^approved\/$/m);
  assert.match(ignore, /^active-change$/m);
  // The marker is the record; a later edit changes nothing.
  hook("post-tool-use", edit(join(repo, "src/b.js")));
  assert.ok(approved("x"));
});

test("post-tool-use writes nothing for a spec-side edit, or when design.md is missing", () => {
  const spec = floorRepo({ mode: "full" });
  spec.write("specs/x/design.md", "# x\n");
  spec.write("specs/x/implementation.md", ledger("designed"));
  spec.hook("post-tool-use", edit(join(spec.repo, "specs/x/implementation.md")));
  assert.ok(!spec.approved("x"), "a spec-side edit is not an approval");

  const nodesign = floorRepo({ mode: "full" });
  nodesign.write("specs/x/implementation.md", ledger("designed"));
  nodesign.hook("post-tool-use", edit(join(nodesign.repo, "src/a.js")));
  assert.ok(!nodesign.approved("x"), "a change with no design cannot be approved");
  assert.ok(!fsExists(join(nodesign.repo, ".praxis")), "nothing to record, nothing scaffolded");
});

test("post-tool-use records nothing in fast, and nothing with PRAXIS_FLOOR=off", () => {
  const fast = floorRepo({ mode: "fast" });
  fast.write("specs/x/design.md", "# x\n");
  fast.write("specs/x/implementation.md", ledger("designed"));
  fast.hook("post-tool-use", edit(join(fast.repo, "src/a.js")));
  assert.ok(!fast.approved("x"), "in fast nothing asked, so nothing was approved");

  const off = floorRepo({ mode: "full" });
  off.write("specs/x/design.md", "# x\n");
  off.write("specs/x/implementation.md", ledger("designed"));
  off.hook("post-tool-use", edit(join(off.repo, "src/a.js")), { PRAXIS_FLOOR: "off" });
  assert.ok(!off.approved("x"), "with the floor off no ask happened; a marker would be a forged approval");
});

test("post-tool-use reads Codex apply_patch headers too", () => {
  const { repo, hook, write, approved } = floorRepo({ mode: "full" });
  write("specs/x/design.md", "# x\n");
  write("specs/x/implementation.md", ledger("designed"));
  const patch = "*** Begin Patch\n*** Update File: lib/b.py\n@@\n+x\n*** End Patch";
  const env = { PLUGIN_ROOT: ROOT, PLUGIN_DATA: codexData(repo) };
  hook("post-tool-use", { tool_name: "apply_patch", cwd: repo, tool_input: { command: patch } }, env);
  assert.ok(approved("x"));
});

// Under Codex praxis_state_dir is PLUGIN_DATA; give the fixture a mode file there.
function codexData(repo) {
  const dir = join(repo, "..", `${repo.split("/").pop()}-data`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".praxis-mode"), "full");
  return dir;
}

// A deny the model cannot follow is a deny it works around: the first live cell refused
// three reads of the plugin directory and then wrote a design from memory. So the deny
// copies the templates into the project and points only at that local copy.
test("a deny copies the templates into the project and refers to them relatively", () => {
  const { repo, hook } = floorRepo({ mode: "full" });
  const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(out), "deny");
  for (const f of ["design.md", "implementation.md", "AGENTS.md", "CLAUDE.md"]) {
    assert.ok(fsExists(join(repo, "specs/_templates", f)), `specs/_templates/${f} not placed`);
  }
  assert.match(reason(out), /Read specs\/_templates\/design\.md, then Write specs\/<change>\/design\.md/);
  assert.doesNotMatch(reason(out), new RegExp(ROOT.replace(/\/$/, "")), "the plugin path must not appear: the model cannot read it");
  assert.doesNotMatch(reason(out), /\bcp\b/, "the model writes with its Write tool; it is not told to run cp");
  assert.match(reason(out), /Technical Design/, "the shape is repeated for a model that still cannot read");
  // Idempotent: a second deny does not touch an existing copy.
  writeFileSync(join(repo, "specs/_templates/design.md"), "local edit\n");
  hook("pre-tool-use", edit(join(repo, "src/b.js")));
  assert.equal(fsRead(join(repo, "specs/_templates/design.md"), "utf8"), "local edit\n");
});

test("an allowed edit never writes into the project", () => {
  const { repo, hook, write } = floorRepo({ mode: "fast" });
  write("specs/x/implementation.md", ledger("new"));
  hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.ok(!fsExists(join(repo, "specs/_templates")), "templates were placed on an allow");
});

test("pre-tool-use in full denies while design.md is missing, whatever the ledger says", () => {
  const { repo, hook, write } = floorRepo({ mode: "full" });
  for (const stage of ["new", "designed", "planned"]) {
    write("specs/x/implementation.md", ledger(stage));
    const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
    assert.equal(decision(out), "deny", `stage ${stage} without a design`);
    assert.match(reason(out), /specs\/x\/design\.md does not exist/);
    assert.match(reason(out), /stage: designed/, "the deny names the exact transition");
  }
});

test("pre-tool-use in fast needs only implementation.md", () => {
  const { repo, hook, write } = floorRepo({ mode: "fast" });
  const bare = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(bare), "deny", "fast still has a floor");
  assert.doesNotMatch(reason(bare), /design\.md/, "fast must not ask for a design document");

  write("specs/x/implementation.md", ledger("new"));
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow");
});

test("pre-tool-use always allows the spec side, so the record can be created", () => {
  const { repo, hook } = floorRepo({ mode: "full" });
  for (const rel of ["specs/x/design.md", ".praxis/active-change", "agents/rules/quality-a.md", "AGENTS.md", "PROGRESS.md"]) {
    assert.equal(decision(hook("pre-tool-use", edit(join(repo, rel)))), "allow", `${rel} was gated`);
  }
});

test("pre-tool-use ignores a target outside the project root", () => {
  const { hook } = floorRepo({ mode: "full" });
  const elsewhere = mkdtempSync(join(tmpdir(), "praxis-elsewhere-"));
  assert.equal(decision(hook("pre-tool-use", edit(join(elsewhere, "notes.md")))), "allow");
});

test("PRAXIS_FLOOR=off lifts the floor, and nothing else does", () => {
  const { repo, hook } = floorRepo({ mode: "deep" });
  const target = edit(join(repo, "src/a.js"));
  assert.equal(decision(hook("pre-tool-use", target, { PRAXIS_FLOOR: "off" })), "allow");
  assert.equal(decision(hook("pre-tool-use", target, { PRAXIS_FLOOR: "no" })), "deny", "only the literal `off` counts");
});

test("pre-tool-use resolves the active change from .praxis/active-change before mtime", () => {
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/old/design.md", "# old\n");
  write("specs/old/implementation.md", ledger("planned"));
  approve("old");
  write("specs/new/implementation.md", ledger("new")); // newest by mtime, no design
  // Without the pointer the newest ledger wins and the edit is denied.
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "deny");
  write(".praxis/active-change", "old\n");
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow");
});

test("pre-tool-use reads Codex apply_patch headers, so the Codex registration is not inert", () => {
  // Patch paths are repo-relative; the host's `cwd` is what they resolve against.
  const { repo, hook } = floorRepo({ mode: "full" });
  const patch = "*** Begin Patch\n*** Update File: lib/b.py\n@@\n+x\n*** End Patch";
  const out = hook("pre-tool-use", { tool_name: "apply_patch", cwd: repo, tool_input: { command: patch } });
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /lib\/b\.py/);
  const spec = "*** Begin Patch\n*** Add File: specs/x/design.md\n@@\n+x\n*** End Patch";
  assert.equal(decision(hook("pre-tool-use", { tool_name: "apply_patch", cwd: repo, tool_input: { command: spec } })), "allow");
});

const stopDecision = (out) => (out.trim() === "" ? "allow" : JSON.parse(out).decision);

test("stop blocks once when source changed and no ledger did", () => {
  const { hook, write, commit } = floorRepo();
  write("specs/x/implementation.md", ledger("designed"));
  write("src/a.js", "1\n");
  commit();
  write("src/a.js", "2\n");
  const out = hook("stop", {});
  assert.equal(stopDecision(out), "block");
  assert.match(JSON.parse(out).reason, /specs\/x\/implementation\.md/, "the block names the active ledger");
  assert.match(JSON.parse(out).reason, /GAP/, "unverified work is recorded as a GAP, not hidden");
});

test("stop allows when the ledger changed alongside the source", () => {
  const { hook, write, commit, repo } = floorRepo();
  write("specs/x/implementation.md", ledger("designed"));
  write("src/a.js", "1\n");
  commit();
  write("src/a.js", "2\n");
  appendFileSync(join(repo, "specs/x/implementation.md"), "- done\n");
  assert.equal(stopDecision(hook("stop", {})), "allow");
});

test("stop never loops: stop_hook_active short-circuits to allow", () => {
  const { hook, write, commit } = floorRepo();
  write("src/a.js", "1\n");
  commit();
  write("src/a.js", "2\n");
  assert.equal(stopDecision(hook("stop", { stop_hook_active: true })), "allow");
  assert.equal(stopDecision(hook("stop", { stop_hook_active: false })), "block");
});

// ── The session marker: "changed this session", not "dirty in this tree" ──────────────────────
//
// specs/stop-session-scope. The first live block on this repo was a no-op turn: five untracked
// docs older than the change sat in docs/ and `stop` counted them. session-start now writes
// `.praxis/session-started`; stop counts only files newer than it. Timestamps are set with
// `touch -t` because bash 3.2's `-nt` compares whole seconds — a test that relied on "written
// a moment later" would pass or fail by the clock.

const backdate = (path, stamp) => execFileSync("touch", ["-t", stamp, path]);
const OLD = "201901010000";
const MARK = "202001010000";

test("session-start writes the session marker on startup and clear, and leaves it on resume", () => {
  const { repo, hook } = floorRepo();
  const marker = join(repo, ".praxis/session-started");
  assert.match(context(hook("session-start", { source: "resume" })), /using-praxis/, "resume still primes");
  assert.ok(!fsExists(marker), "resume must not start a new session scope");

  assert.match(context(hook("session-start", { source: "startup" })), /using-praxis/);
  assert.ok(fsExists(marker));
  assert.match(fsRead(join(repo, ".praxis/.gitignore"), "utf8"), /^session-started$/m, "the marker is per-machine state");

  backdate(marker, MARK);
  hook("session-start", { source: "compact" });
  assert.ok(statSync(marker).mtime < new Date("2020-06-01"), "compact must not touch the marker");
  hook("session-start", { source: "clear" });
  assert.ok(statSync(marker).mtime > new Date("2020-06-01"), "clear starts a new session scope");
});

test("stop ignores a changed file older than the session marker, and blocks on a newer one", () => {
  const { repo, hook, write } = floorRepo();
  write("docs/leftover.md", "someone else's\n");
  backdate(join(repo, "docs/leftover.md"), OLD);
  write(".praxis/session-started", "");
  backdate(join(repo, ".praxis/session-started"), MARK);
  assert.equal(stopDecision(hook("stop", {})), "allow", "a leftover from before the session is not this turn's work");

  write("src/a.js", "now\n");
  assert.equal(stopDecision(hook("stop", {})), "block", "a file newer than the marker is");
});

test("stop counts a ledger newer than the marker, and without a marker counts everything", () => {
  const { repo, hook, write } = floorRepo();
  write("src/a.js", "now\n");
  write(".praxis/session-started", "");
  backdate(join(repo, ".praxis/session-started"), MARK);
  write("specs/x/implementation.md", ledger("planned") + "- done\n");
  assert.equal(stopDecision(hook("stop", {})), "allow", "the ledger written this session records the work");

  const bare = floorRepo();
  bare.write("docs/leftover.md", "old\n");
  backdate(join(bare.repo, "docs/leftover.md"), OLD);
  assert.equal(stopDecision(bare.hook("stop", {})), "block", "no marker → the working tree, as before");
});

test("stop allows outside git, and with PRAXIS_FLOOR=off", () => {
  const plain = floorRepo({ git: false });
  plain.write("src/a.js", "1\n");
  assert.equal(stopDecision(plain.hook("stop", {})), "allow");

  const { hook, write, commit } = floorRepo();
  write("src/a.js", "1\n");
  commit();
  write("src/a.js", "2\n");
  assert.equal(stopDecision(hook("stop", {}, { PRAXIS_FLOOR: "off" })), "allow");
});

test("subagent-stop counts task states across every spec folder, never the templates", () => {
  const { repo, hook, write } = floorRepo({ git: false });
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  write("specs/a/implementation.md", "- T1 · state: done\n- T2 · state: done\n- T3 · state: pending\n");
  write("specs/b/implementation.md", "- T1 · state: blocked(technical)\n");
  write("specs/_templates/implementation.md", "- T1 · state: pending\n- T2 · state: pending\n");
  write("PROGRESS.md", "- T9 · state: done\n"); // the index, not a ledger, once specs exist
  hook("subagent-stop", { agent_type: "engineer" });
  const row = JSON.parse(fsRead(join(repo, ".praxis/memory/sessions.jsonl"), "utf8").trim());
  assert.equal(row.tasks, "done=2 blocked=1 pending=1");
});

test("subagent-stop falls back to PROGRESS.md where the folder model is not adopted", () => {
  const { repo, hook, write } = floorRepo({ git: false });
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  write("PROGRESS.md", "- T1 · state: done\n- T2 · state: pending\n- T3 · state: pending\n");
  hook("subagent-stop", { agent_type: "engineer" });
  const row = JSON.parse(fsRead(join(repo, ".praxis/memory/sessions.jsonl"), "utf8").trim());
  assert.equal(row.tasks, "done=1 blocked=0 pending=2");
});

// ── Tier-1 comment discipline: the first content pass in the plugin ──────────────────────────
//
// specs/comment-discipline, ADR-001/ADR-002. Two gates, and the second matters more than the
// first: a floor that denies a Go doc comment, a rustdoc example or an owned TODO blocks
// correct work, which is worse than no floor at all. Per `evidence-discipline` every detector
// was mutated in both directions — remove it and the matching test goes red, restore it and it
// goes green — and the eight outputs are pasted in specs/comment-discipline/implementation.md
// under T02.

// A change whose design is written and approved, so the spec floor is silent and the only
// thing that can speak is the comment pass.
function commentRepo() {
  const fixture = floorRepo({ mode: "full" });
  fixture.write("specs/x/design.md", "# x\n");
  fixture.write("specs/x/implementation.md", ledger("planned"));
  fixture.approve("x");
  return fixture;
}

const wrote = (repo, rel, content) => ({ tool_name: "Write", tool_input: { file_path: join(repo, rel), content } });
const edited = (repo, rel, old_string, new_string) =>
  ({ tool_name: "Edit", tool_input: { file_path: join(repo, rel), old_string, new_string } });

test("the content extractor survives a body that praxis_json_string truncates", () => {
  // The discriminating payload. praxis_json_string's sed body is "key"…"\([^"]*\)", so it
  // stops at the first escaped quote — here the value would end at `const s = ` and the
  // banner two lines later would never be read. Without a real extractor this whole
  // section is vacuous, so it is proved before anything is asserted on top of it.
  const { repo, hook } = commentRepo();
  const content = 'const s = "a \\"quoted\\" string";\nconst t = 2;\n// ==========================\n';
  const out = hook("pre-tool-use", wrote(repo, "src/a.js", content));
  assert.equal(decision(out), "deny", "a multi-line body carrying an escaped quote must still be scanned");
  assert.match(reason(out), /Banner and divider/);
});

test("tier 1 denies commented-out code, and the reason names the exact line", () => {
  const { repo, hook } = commentRepo();
  const lines = [
    "// const total = compute(x);",
    "// doThing();",
    "// if (ready) {",
    "// return null;",
    "// import { parse } from \"./parse\";",
    "// }",
    "// <div className=\"row\">",
  ];
  for (const line of lines) {
    const out = hook("pre-tool-use", wrote(repo, "src/a.js", `const ok = 1;\n${line}\nconst also = 2;\n`));
    assert.equal(decision(out), "deny", `not denied: ${line}`);
    assert.match(reason(out), /Commented-out code — git holds the history\./);
    assert.ok(reason(out).includes(line), `the reason must quote the offending line: ${line}`);
  }
});

test("tier 1 denies banner and divider comments, and the reason names the exact line", () => {
  const { repo, hook } = commentRepo();
  const cases = [
    ["src/a.js", "// ============================="],
    ["src/a.js", "/* ----------------------- */"],
    ["src/a.py", "# -----------------------------"],
    ["src/a.js", " * ****************************"],
    ["src/a.sql", "-- ============================"],
  ];
  for (const [file, line] of cases) {
    const out = hook("pre-tool-use", wrote(repo, file, `x\n${line}\ny\n`));
    assert.equal(decision(out), "deny", `not denied: ${line}`);
    assert.match(reason(out), /Banner and divider comments/);
    assert.ok(reason(out).includes(line.trim()), `the reason must quote the offending line: ${line}`);
  }
});

test("tier 1 denies chain-of-thought leakage, and the reason names the exact line", () => {
  const { repo, hook } = commentRepo();
  const lines = [
    "// Step 1: build the lookup map",
    "// Now let's wire the reducer",
    "// As requested, the retry is capped at three",
    "// Per your request, the cache is off by default",
    "// I'll come back to the streaming path",
    "// Let's keep the two paths separate for now",
    "// This is the shape the user asked for",
  ];
  for (const line of lines) {
    const out = hook("pre-tool-use", wrote(repo, "src/a.js", `const ok = 1;\n${line}\n`));
    assert.equal(decision(out), "deny", `not denied: ${line}`);
    assert.match(reason(out), /Chain-of-thought leakage/);
    assert.ok(reason(out).includes(line), `the reason must quote the offending line: ${line}`);
  }
});

test("tier 1 denies a TODO with no owner and no tracker, and names the accepted forms", () => {
  const { repo, hook } = commentRepo();
  for (const [file, line] of [["src/a.js", "// TODO: fix this later"], ["src/a.py", "# TODO: handle the empty case"]]) {
    const out = hook("pre-tool-use", wrote(repo, file, `x\n${line}\n`));
    assert.equal(decision(out), "deny", `not denied: ${line}`);
    assert.match(reason(out), /A `TODO` with no owner and no tracker/);
    assert.match(reason(out), /TODO\(username\)/, "the deny must name the owner form");
    assert.match(reason(out), /crbug\.com/, "and the tracker form");
    assert.ok(reason(out).includes(line), `the reason must quote the offending line: ${line}`);
  }
});

// The gate that matters more than the four above. Every line here is mandated or endorsed by
// somebody's published guidance — Go's doc comment rule, Rust C-EXAMPLE, Google's own named
// exception to why-not-what, Google C++ and Google Python on TODO — so a deny on any of them
// is Praxis breaking a language's own rules (ADR-005).
test("the false-positive gate: legitimate comments are allowed, every one of them", () => {
  const { repo, hook } = commentRepo();
  const allowed = [
    // A Go exported doc comment necessarily echoes the identifier — go.dev/doc/comment.
    ["src/cfg.go", "// Parse returns the parsed configuration.\nfunc Parse() {}\n"],
    // A Rust public item carries a compiling example — C-EXAMPLE. Its body IS code.
    ["src/lib.rs", "/// Adds two numbers.\n///\n/// # Examples\n///\n/// ```\n/// let sum = add(1, 2);\n/// assert_eq!(sum, 3);\n/// ```\npub fn add(a: i32, b: i32) -> i32 { a + b }\n"],
    // Google's named exception: regexes and complex algorithms benefit from what-comments.
    ["src/re.js", "// Matches /^(\\d{3})-(\\d{4})$/ — the legacy phone format kept for imports.\nconst RE = /x/;\n"],
    ["src/sort.js", "// Insertion sort beats quicksort below ~12 elements: no partition overhead.\nfunction s() {}\n"],
    // The two TODO forms the craft cites.
    ["src/a.js", "// TODO(alice): switch to the streaming parser.\n"],
    ["src/a.py", "# TODO: crbug.com/192795 - Investigate cpufreq optimizations.\n"],
    ["src/a.js", "// TODO: see #1234 for the migration plan.\n"],
    // Prose that happens to contain the word "step".
    ["src/a.js", "// Each step of the pipeline is idempotent, so a retry is safe.\n"],
    ["src/a.py", "# Step through the list backwards; the tail is the newest entry.\n"],
    ["src/a.js", "// Step 2 of the handshake is the challenge.\n"],
    // Four chain-of-thought branches were cut for these, and each line is why.
    ["src/a.js", "// First, normalise the input; the parser assumes NFC.\n"],
    ["src/a.js", "// Now we hold the lock, so the read is safe.\n"],
    ["src/a.js", "// Here is why the offset is 1-based: the protocol counts from one.\n"],
    ["src/a.js", "// We have seen this fail on ARM when the buffer is unaligned.\n"],
    ["src/a.js", "// Immutable by construction: every setter returns a copy.\n"],
    // A URL inside a comment, containing // and --.
    ["src/a.js", "// See https://example.com/spec#a--b for why the offset is 1-based.\n"],
    ["src/a.sql", "-- See https://example.com/a--b for the rationale behind this index.\n"],
    // Prose that reads like code to a naive matcher.
    ["src/a.js", "// baseUrl = the API root; every request is resolved against it.\n"],
    ["src/a.py", "# Returns the user, if any. Callers must handle None.\n"],
    ["src/a.js", "// private helper: used only by parse()\n"],
    ["src/a.js", "// const is preferred here because the binding never moves.\n"],
    ["src/a.js", "// n=1 per arm is a screening pass, not a proof.\n"],
    // A numpy-style docstring underline is not a SQL comment.
    ["src/a.py", '"""Parameters\n----------\nx : int\n"""\n'],
  ];
  for (const [file, content] of allowed) {
    const out = hook("pre-tool-use", wrote(repo, file, content));
    assert.equal(decision(out), "allow", `false positive on ${file}: ${content.split("\n")[0]}\n${out}`);
  }
});

test("a tier-1 pattern already in the file is never the reason a write is refused", () => {
  const { repo, hook } = commentRepo();
  // old_string carries all four patterns; new_string adds a line and keeps them.
  const old_string = [
    "// =============================",
    "// Step 1: the original narration",
    "// TODO: left by whoever wrote this",
    "// legacy = compute(old);",
    "run();",
  ].join("\n");
  const new_string = `${old_string}\nrunAgain();`;
  assert.equal(decision(hook("pre-tool-use", edited(repo, "src/a.js", old_string, new_string))), "allow");

  // Re-indenting an existing comment does not turn it into an added line either.
  const indented = old_string.split("\n").map((l) => `  ${l}`).join("\n");
  assert.equal(decision(hook("pre-tool-use", edited(repo, "src/a.js", old_string, indented))), "allow");

  // But the same edit that ALSO adds one is denied — otherwise this test proves nothing.
  const withNew = `${old_string}\n// ##############################`;
  const out = hook("pre-tool-use", edited(repo, "src/a.js", old_string, withNew));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /Banner and divider/);
});

test("MultiEdit pools every old_string before deciding what this edit adds", () => {
  const { repo, hook } = commentRepo();
  const payload = (edits) => ({ tool_name: "MultiEdit", tool_input: { file_path: join(repo, "src/a.js"), edits } });
  assert.equal(
    decision(hook("pre-tool-use", payload([
      { old_string: "// TODO: from before\na();", new_string: "// TODO: from before\na();\nb();" },
      { old_string: "c();", new_string: "c();\nd();" },
    ]))),
    "allow",
    "a pre-existing pattern carried through every entry stays allowed",
  );
  const out = hook("pre-tool-use", payload([
    { old_string: "a();", new_string: "a();\nb();" },
    { old_string: "c();", new_string: "c();\n// Now let's add the cache" },
  ]));
  assert.equal(decision(out), "deny", "a pattern added by the second entry is still caught");
  assert.match(reason(out), /Chain-of-thought leakage/);
});

test("the carve-outs are mechanical: generated, lockfiles, minified, prose", () => {
  const { repo, hook } = commentRepo();
  const banner = "// =============================";
  const skipped = [
    ["node_modules/pkg/index.js", banner],
    ["dist/bundle.js", banner],
    ["build/out.js", banner],
    ["vendor/lib.js", banner],
    [".next/static/a.js", banner],
    ["src/app.min.js", banner],
    ["package-lock.json", banner],
    ["yarn.lock", banner],
    ["go.sum", banner],
    ["README.md", "# -----------------------------"],
    ["docs/notes.txt", banner],
  ];
  for (const [file, line] of skipped) {
    assert.equal(decision(hook("pre-tool-use", wrote(repo, file, `x\n${line}\n`))), "allow", `not carved out: ${file}`);
  }
  // The @generated marker, wherever it sits in the content.
  assert.equal(
    decision(hook("pre-tool-use", wrote(repo, "src/schema.js", `// @generated by protoc\n${banner}\n`))),
    "allow",
  );
  // And the control: the same line in a plain source file is denied.
  assert.equal(decision(hook("pre-tool-use", wrote(repo, "src/plain.js", `x\n${banner}\n`))), "deny");
});

test("PRAXIS_COMMENTS=off lifts the comment pass alone; PRAXIS_FLOOR=off lifts both", () => {
  const { repo, hook } = commentRepo();
  const payload = wrote(repo, "src/a.js", "x\n// =============================\n");
  assert.equal(decision(hook("pre-tool-use", payload)), "deny", "the control");
  assert.equal(decision(hook("pre-tool-use", payload, { PRAXIS_COMMENTS: "off" })), "allow");
  assert.equal(decision(hook("pre-tool-use", payload, { PRAXIS_FLOOR: "off" })), "allow");

  // The narrow override really is narrow: with the comment pass off, the spec floor still bites.
  const bare = floorRepo({ mode: "full" });
  const out = bare.hook("pre-tool-use", wrote(bare.repo, "src/a.js", "x\n"), { PRAXIS_COMMENTS: "off" });
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /design\.md/);
});

test("the comment pass fails open on anything it cannot read", () => {
  const { repo, hook } = commentRepo();
  const banner = "// =============================";
  // A tool that carries no readable content, a body with no comment at all, an empty edit.
  assert.equal(decision(hook("pre-tool-use", { tool_name: "NotebookEdit", tool_input: { file_path: join(repo, "src/a.ipynb"), new_source: banner } })), "allow");
  assert.equal(decision(hook("pre-tool-use", wrote(repo, "src/a.js", "const a = 1;\n"))), "allow");
  assert.equal(decision(hook("pre-tool-use", edited(repo, "src/a.js", "", ""))), "allow");
  assert.equal(decision(hook("pre-tool-use", wrote(repo, "src/a.js", ""))), "allow");
  // A minified line: 600 characters with a banner buried in it is data, not prose.
  assert.equal(decision(hook("pre-tool-use", wrote(repo, "src/a.js", `${banner}${"x".repeat(600)}\n`))), "allow");
});

test("the comment pass reads a Codex apply_patch, where added lines are marked", () => {
  const { repo, hook, write } = commentRepo();
  write(".praxis/approved/x", "");
  const patch = "*** Begin Patch\n*** Update File: src/a.js\n@@\n a();\n+// Step 3: reset the cursor\n*** End Patch";
  const env = { PLUGIN_ROOT: ROOT, PLUGIN_DATA: codexData(repo) };
  const out = hook("pre-tool-use", { tool_name: "apply_patch", cwd: repo, tool_input: { command: patch } }, env);
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /Chain-of-thought leakage/);
  // A context line carrying the same pattern is not an added line.
  const context = "*** Begin Patch\n*** Update File: src/a.js\n@@\n // Step 3: reset the cursor\n+a();\n*** End Patch";
  assert.equal(decision(hook("pre-tool-use", { tool_name: "apply_patch", cwd: repo, tool_input: { command: context } }, env)), "allow");
});

test("the decoded body is byte-exact: backslashes survive, lines stay separate", () => {
  // Two real defects found here, both in restoring a parked backslash: gsub doubled it,
  // and split/join joined the value's lines with it (BWK awk splits on newline whatever
  // separator it is handed). Either one corrupts the line the deny is about to quote, so
  // the repro is the test: a multi-line body whose offending line carries backslashes.
  const { repo, hook } = commentRepo();
  const line = String.raw`// Now let's write to C:\temp\out\\shared`;
  const out = hook("pre-tool-use", wrote(repo, "src/a.js", `const a = 1;\nconst b = 2;\n${line}\n`));
  assert.equal(decision(out), "deny");
  assert.ok(reason(out).includes(line), `the quoted line was corrupted in decoding:\n${reason(out)}`);
});
