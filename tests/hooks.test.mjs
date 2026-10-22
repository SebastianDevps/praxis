// Hook behavior. These cover the injection path added for per-turn and
// per-subagent context: two real bugs surfaced here during development (Codex
// falling through to the flat Copilot shape, which Codex drops silently, and
// grep leaking "brackets not balanced" to stderr on every spawn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, accessSync, constants, mkdtempSync, rmSync } from "node:fs";
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

// specs/factory-cycle, "Contract diet": the per-turn text is a kernel of at most 40 lines that
// routes a substantial change into the `factory` skill; the Run Card, the ladder and the crafts
// list left it. What must still arrive every turn is the routing and the four verification states.
test("user-prompt-submit injects the orchestrator kernel every turn", () => {
  const ctx = context(claude("user-prompt-submit"));
  assert.match(ctx, /invoke `factory`/, "the kernel must route a substantial change into the cycle");
  assert.match(ctx, /PASS · FAIL · SKIP · GAP/, "and keep the four verification states");
});

test("the kernel file stays within its 40-line budget", () => {
  // `wc -l` counts newlines, which is the number the design's acceptance gate names.
  const newlines = readFileSync(join(ROOT, "hooks/context/contract.md"), "utf8").split("\n").length - 1;
  assert.ok(newlines <= 40, `hooks/context/contract.md is ${newlines} lines; the budget is 40`);
});

test("subagent-start injects a role kernel, never the orchestrator's contract", () => {
  const ctx = context(claude("subagent-start"));
  assert.doesNotMatch(ctx, /RUN CARD/, "a specialist must not be told to render Run Cards");
  assert.doesNotMatch(ctx, /invoke `factory`/, "a specialist must not be told to run the cycle");
  assert.match(ctx, /\[cmd\] → \[output\]/, "but it keeps the evidence rule");
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

test("an unknown or stock agent still receives the default kernel", () => {
  const ctx = context(claude("subagent-start", { input: '{"agent_type":"Explore"}' }));
  assert.deepEqual(craftsIn(ctx), []);
  assert.match(ctx, /PASS · FAIL · SKIP · GAP/);
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
    /\[cmd\] → \[output\]/,
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
  assert.match(ctx, /\[cmd\] → \[output\]/);
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
  assert.match(ctx, /One approval per change/, "full carries the approval stop");
});

test("a mode switch persists to the next turn", () => {
  const { call } = withHome("noop");
  assert.match(context(call("/praxis fast")), /MODE CHANGED — fast/);
  const next = context(call("now fix the bug"));
  assert.match(next, /active mode: fast/, "the level must outlive the turn that set it");
  assert.doesNotMatch(next, /One approval per change/, "fast drops the approval stop — it has no spec to approve");
  assert.match(next, /Fast mode/);
});

// ADR-004 (specs/factory-cycle): two modes. `deep` is accepted for one release and persists as
// `full`, with a notice, so a muscle-memory `/praxis:mode deep` never leaves a session unprimed.
test("/praxis:mode deep maps to full and says so", () => {
  const { call } = withHome("noop");
  assert.match(context(call("/praxis:mode deep")), /deep is now full \(ADR-004\)/);
  const ctx = context(call("design the schema"));
  assert.match(ctx, /active mode: full/, "deep must persist as full, not as deep");
  assert.doesNotMatch(ctx, /Deep mode/, "no deep-only block survives in the kernel");
});

test("an unrecognized level is ignored rather than applied", () => {
  const { call } = withHome("noop");
  call("/praxis fast");
  const ctx = context(call("/praxis banana"));
  assert.match(ctx, /active mode: fast/, "a bad argument must not silently change the level");
});

test("the dial changes ceremony, never the verification rules or the safety carve-outs", () => {
  const { call } = withHome("noop");
  call("/praxis fast");
  const ctx = context(call("ship it"));
  for (const kept of [/PASS · FAIL · SKIP · GAP/, /stale assumptions/, /trust boundaries/, /accessibility/]) {
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
  run("user-prompt-submit", { input: '{"prompt":"/praxis fast"}', env });
  const ctx = context(run("subagent-start", { input: '{"agent_type":"engineer"}', env }));
  assert.match(ctx, /active mode: fast/, "the dial must travel with the dispatch");
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
  assert.match(ctx, /PASS · FAIL · SKIP · GAP/);
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
  assert.match(ctx, /\[cmd\] → \[output\]/, "the kernel still arrives");

  // CONSTRAINTS.md alone is still a standard the reviewer reads.
  const only = rulesRepo({ rules: false, constraints: true });
  assert.match(context(only.dispatch("praxis:reviewer").stdout), /`CONSTRAINTS\.md` — Quality bar/);
});

// ── The cycle's roles receive a kernel, not the contract (specs/factory-cycle) ─────────────────
//
// Every subagent used to receive the 103-line contract plus crafts plus skill pointers. The cycle
// gives each role a kernel of at most 15 lines and one line naming the active change's files; the
// builder, the role under the most context pressure, is the one measured. Both directions again:
// the builder must receive its crafts and the change line, and must NOT receive skill pointers, a
// Run Card, the kernel's orchestrator rules or the project's standards.

function dispatchRepo({ spec = "spec.md" } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "praxis-cycle-"));
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  writeFileSync(join(repo, ".praxis/active-change"), "export-csv\n");
  if (spec) {
    mkdirSync(join(repo, "specs/export-csv"), { recursive: true });
    writeFileSync(join(repo, `specs/export-csv/${spec}`), "---\ntitle: export-csv\n---\n");
  }
  const dispatch = (agent) =>
    spawnSync("bash", [join(ROOT, "hooks", "subagent-start")], {
      env: { ...CLEAN, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: repo },
      input: JSON.stringify({ agent_type: agent }),
      encoding: "utf8",
      timeout: 10_000,
    });
  return { repo, dispatch };
}

// The kernel is everything above the first `---` separator (crafts, pointers and rules follow it),
// minus the mode header and the change line.
const kernelLines = (ctx) =>
  ctx.split(/^---$/m)[0].split("\n")
    .filter((l) => l.trim() !== "" && !/^PRAXIS — active mode/.test(l) && !/^Change: /.test(l));

const CHANGE_LINE = /^Change: export-csv · spec: specs\/export-csv\/spec\.md · ledger: specs\/export-csv\/implementation\.md \(orchestrator-only\)$/m;

test("builder receives its role kernel, the change line and its crafts — nothing else", () => {
  const ctx = context(dispatchRepo().dispatch("praxis:builder").stdout);
  const kernel = kernelLines(ctx);
  assert.ok(kernel.length <= 15, `builder kernel is ${kernel.length} lines:\n${kernel.join("\n")}`);
  assert.match(ctx, CHANGE_LINE);
  const crafts = craftsIn(ctx);
  for (const craft of ["minimalism", "evidence-discipline"]) {
    assert.ok(crafts.includes(craft), `builder lost the ${craft} craft — got ${crafts}`);
  }
  assert.equal(crafts.length, 2, `builder's craft count moved — confirm the number: ${crafts}`);
  for (const absent of [/RUN CARD/, /Skills declared for/, /Project standards for/, /Answer first/, /invoke `factory`/]) {
    assert.doesNotMatch(ctx, absent, "the builder received more than its kernel, the change line and its crafts");
  }
});

test("every cycle role gets a kernel of at most 15 lines, the change line and the evidence rule", () => {
  const { dispatch } = dispatchRepo({ spec: null }); // the spec is about to be written: the line still names it
  for (const role of ["spec-writer", "builder", "refuter-correctness", "refuter-security", "refuter-tests", "lens-ui", "approver"]) {
    const ctx = context(dispatch(`praxis:${role}`).stdout);
    const kernel = kernelLines(ctx);
    assert.ok(kernel.length <= 15, `${role} kernel is ${kernel.length} lines`);
    assert.match(ctx, CHANGE_LINE, `${role} did not receive the change line`);
    assert.match(ctx, /\[cmd\] → \[output\]/, `${role} lost the evidence rule`);
    assert.match(ctx, /PASS · FAIL · SKIP · GAP/, `${role} lost the four states`);
    assert.doesNotMatch(ctx, /RUN CARD/, `${role} was told to render Run Cards`);
  }
});

test("the lenses and the approver receive the project's rules as pointers; the builder does not", () => {
  const { dispatch } = rulesRepo();
  for (const judge of ["praxis:refuter-correctness", "refuter-security", "praxis:refuter-tests", "lens-ui", "praxis:approver"]) {
    const ctx = context(dispatch(judge).stdout);
    assert.match(ctx, /`agents\/rules\/quality-x\.md` — Quality X/, `${judge} received no rule pointer`);
    assert.ok(!ctx.includes("RULE-BODY-SENTINEL"), `a rule body leaked into ${judge}`);
  }
  assert.doesNotMatch(context(dispatch("praxis:builder").stdout), /Project standards for/, "the builder received the rules section");
});

test("the change line names the legacy design.md when the change has no spec.md", () => {
  const ctx = context(dispatchRepo({ spec: "design.md" }).dispatch("engineer").stdout);
  assert.match(ctx, /^Change: export-csv · spec: specs\/export-csv\/design\.md · ledger: specs\/export-csv\/implementation\.md \(orchestrator-only\)$/m);
});

test("a project with no active change injects no change line", () => {
  const repo = mkdtempSync(join(tmpdir(), "praxis-nochange-"));
  const out = spawnSync("bash", [join(ROOT, "hooks", "subagent-start")], {
    env: { ...CLEAN, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: repo },
    input: '{"agent_type":"engineer"}',
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(out.status, 0);
  assert.doesNotMatch(context(out.stdout), /^Change: /m);
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
  // A hook that crashed, or fell through with a stderr line, must never read as "allow": the
  // hooks run `set -u` without `-e`, and an empty stdout IS the allow (tests lens, round 1).
  const hook = (name, input, extra = {}) => {
    const r = spawnSync("bash", [join(ROOT, "hooks", name)], {
      env: { ...CLEAN, ...env, ...extra },
      input: JSON.stringify(input),
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.equal(r.status, 0, `${name} exited ${r.status}: ${r.stderr}`);
    if (name === "pre-tool-use" || name === "post-tool-use") {
      assert.equal(r.stderr, "", `${name} wrote to stderr — a fall-through is not an allow: ${r.stderr}`);
    }
    return r.stdout;
  };
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
  assert.match(reason(out), /Write specs\/<change>\/spec\.md/, "spec.md is the file to write");
  assert.match(reason(out), /legacy specs\/<change>\/design\.md/, "design.md is named only as the accepted legacy form");
  assert.match(reason(out), /implementation\.md/);
  assert.match(reason(out), /active-change/, "the deny must say how to name the change");
  assert.match(reason(out), /PRAXIS_FLOOR=off/, "the only override is stated, not hidden");
});

test("pre-tool-use in full allows once the legacy design.md exists and the person approved it", () => {
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
    assert.match(reason(out), /Approving this edit approves the spec/);
    assert.match(reason(out), /\.praxis\/approved\/x/, "the ask names the record the approval writes");
    assert.match(reason(out), /\/praxis:approve x/, "and the person's command on hosts without a prompt");
    assert.match(reason(out), /unlocks nothing/, "stage: must not read as the key");
  }
  approve("x");
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "allow");
});

test("the marker is not a bypass: a change whose spec is gone is denied", () => {
  const { repo, hook, write, approve } = floorRepo({ mode: "full" });
  write("specs/x/implementation.md", ledger("planned"));
  approve("x");
  const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /specs\/x\/spec\.md does not exist \(nor the legacy design\.md\)/);
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
  assert.match(reason(out), /Approving this edit approves the spec/);
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
  // The form to READ flips from design.md to spec.md when the plugin ships that template (T05);
  // the file to WRITE is spec.md either way.
  assert.match(reason(out), /Read specs\/_templates\/(spec|design)\.md, then Write specs\/<change>\/spec\.md/);
  assert.doesNotMatch(reason(out), new RegExp(ROOT.replace(/\/$/, "")), "the plugin path must not appear: the model cannot read it");
  assert.doesNotMatch(reason(out), /\bcp\b/, "the model writes with its Write tool; it is not told to run cp");
  assert.match(reason(out), /Acceptance \(runnable checks/, "the shape is repeated for a model that still cannot read");
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

test("pre-tool-use in full denies while the spec is missing, whatever the ledger says", () => {
  const { repo, hook, write } = floorRepo({ mode: "full" });
  for (const stage of ["new", "designed", "planned"]) {
    write("specs/x/implementation.md", ledger(stage));
    const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
    assert.equal(decision(out), "deny", `stage ${stage} without a spec`);
    assert.match(reason(out), /specs\/x\/spec\.md does not exist/);
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
  assert.match(reason(out), /spec\.md/);
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

// ── The cycle's limits: barrier, round cap, ship gate, escalation record ──────────────────────
//
// specs/factory-cycle, design.md appendix. Every input these gates decide on is a file under
// specs/<change>/; the fixtures write those files and nothing else, so a test here never
// depends on what a model said. Mutation-tested before trusting: disable the round-cap
// branch in `hooks/pre-tool-use` and the cap test goes red while the barrier tests stay
// green — the run is pasted in specs/factory-cycle/implementation.md under T01.

function cycleRepo({ mode = "full", round = 0, builder = "agent-b1", lenses = "correctness, security, tests" } = {}) {
  const fixture = floorRepo({ mode });
  fixture.write("specs/x/spec.md", "# x\n");
  fixture.write(
    "specs/x/implementation.md",
    `---\ntitle: x\nstage: built\nround: ${round}     # 0 = no review yet\nbuilder: ${builder}\nlenses: ${lenses}\nowner: o\n---\n\n## Tasks\n`,
  );
  fixture.write(".praxis/active-change", "x\n");
  fixture.approve("x");
  const lens = (r, name, verdict) =>
    fixture.write(
      `specs/x/review/round-${r}/${name}.md`,
      `---\nlens: ${name}\nround: ${r}\nverdict: ${verdict}\n---\n\n## Findings\n\n## What I tried to break\n- a → b\n`,
    );
  const lensList = (r, names) => fixture.write(`specs/x/review/round-${r}/lenses`, `${names.join("\n")}\n`);
  const recordDecision = (verdict, r = round) =>
    fixture.write("specs/x/decision.md", `---\nverdict: ${verdict}\nround: ${r}\n---\n\n## Checks run\n- x → y\n## Reason\n`);
  return { ...fixture, lens, lensList, recordDecision };
}

const dispatchBuilder = (subagent_type = "praxis:builder") =>
  ({ tool_name: "Agent", tool_input: { subagent_type, prompt: "build it", description: "builder" } });
const messageTo = (to) => ({ tool_name: "SendMessage", tool_input: { to, message: "fix these" } });
const bash = (command, cwd) => ({ tool_name: "Bash", tool_input: { command, description: "ship" }, ...(cwd ? { cwd } : {}) });

test("builder dispatch at round 0 is allowed: no review has run, nothing to wait for", () => {
  const { hook } = cycleRepo({ round: 0 });
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow");
  assert.equal(decision(hook("pre-tool-use", messageTo("agent-b1"))), "allow");
});

test("the barrier: a builder dispatch is denied while a lens file is missing, naming the missing lens", () => {
  const { hook, lens, lensList } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests"]);
  lens(1, "correctness", "PASS");
  lens(1, "tests", "CHANGES");
  // Every spelling a host may send: namespaced, bare, and either case.
  for (const payload of [dispatchBuilder(), dispatchBuilder("builder"), dispatchBuilder("Builder"), dispatchBuilder("praxis:Builder")]) {
    const out = hook("pre-tool-use", payload);
    assert.equal(decision(out), "deny", JSON.stringify(payload.tool_input.subagent_type));
    assert.match(reason(out), /barrier: waiting for security\b/, "the deny names exactly the lens that has not written");
    assert.doesNotMatch(reason(out), /waiting for [^—]*(correctness|tests)/, "a lens that has written is not waited for");
    assert.match(reason(out), /PRAXIS_FLOOR=off/);
  }
  // A dispatch of anything but the builder is not the barrier's business.
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder("praxis:refuter-tests"))), "allow");
  // The barrier opens the moment the last file lands; CHANGES at round 1 is the one fix round.
  lens(1, "security", "PASS");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow");
});

test("the barrier reads SendMessage to the builder id the ledger records, and to nobody else", () => {
  const { hook, lens, lensList } = cycleRepo({ round: 1, builder: "agent-b1" });
  lensList(1, ["correctness", "security", "tests"]);
  lens(1, "correctness", "PASS");
  lens(1, "tests", "PASS");
  const out = hook("pre-tool-use", messageTo("agent-b1"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /barrier: waiting for security/);
  assert.equal(decision(hook("pre-tool-use", messageTo("agent-other"))), "allow", "a message to another agent is not a builder resume");
  lens(1, "security", "PASS");
  assert.equal(decision(hook("pre-tool-use", messageTo("agent-b1"))), "allow", "complete and all PASS");
});

test("the round cap: a builder dispatch that would open round 3 is denied", () => {
  const { hook, lens, lensList } = cycleRepo({ round: 2 });
  lensList(2, ["correctness", "security", "tests"]);
  lens(2, "correctness", "PASS");
  lens(2, "security", "CHANGES");
  lens(2, "tests", "PASS");
  const out = hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /round cap: 2 rounds done → approver \/ ESCALATE/);
  assert.match(reason(out), /security: CHANGES/, "the deny says which lens is not PASS");
  // SKIP is not PASS either, and the resume path hits the same cap.
  lens(2, "security", "SKIP");
  assert.match(reason(hook("pre-tool-use", messageTo("agent-b1"))), /round cap/);
  // Round 2 with every lens PASS: nothing to fix, nothing to cap.
  lens(2, "security", "PASS");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow");
  // Round 1 complete with CHANGES is the fix round the cycle allows.
  const first = cycleRepo({ round: 1 });
  first.lensList(1, ["correctness", "security", "tests"]);
  first.lens(1, "correctness", "CHANGES");
  first.lens(1, "security", "PASS");
  first.lens(1, "tests", "PASS");
  assert.equal(decision(first.hook("pre-tool-use", dispatchBuilder())), "allow", "round 1 → round 2 is the one fix round");
});

// Round 3: the list is unioned with correctness, security and tests (design.md, Round-3
// amendments) — a list can add a lens (ui), never drop a required one.
test("the round's lens list is review/round-N/lenses, else the ledger's lenses: field, always with the three required lenses", () => {
  const { hook, lens } = cycleRepo({ round: 1, lenses: "correctness, tests, ui" });
  lens(1, "correctness", "PASS");
  lens(1, "security", "PASS");
  const out = hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /waiting for tests ui\b/, "the ledger's extra lens is waited for, with the required ones");
  lens(1, "tests", "PASS");
  lens(1, "ui", "PASS");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow");

  const bare = cycleRepo({ round: 1, lenses: "" });
  const none = bare.hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(none), "deny", "a round nobody is listed for is not an open barrier");
  assert.match(reason(none), /waiting for correctness security tests/, "no list still waits for the three");
  assert.match(reason(none), /review\/round-1\/lenses/, "the deny names the file the orchestrator writes");
});

test("the ship gate: gh pr create and git push of praxis/<c> are denied without decision.md", () => {
  const { hook, lens, lensList } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests"]);
  for (const name of ["correctness", "security", "tests"]) lens(1, name, "PASS");
  for (const cmd of ["gh pr create --fill", "git push -u origin praxis/x", 'git commit -m "done" && git push origin praxis/x']) {
    const out = hook("pre-tool-use", bash(cmd));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate: specs\/x\/decision\.md does not exist/);
    assert.match(reason(out), /\/praxis:approve x/, "the deny names the person's way out");
  }
  // Other Bash is not the gate's business. A push of another branch while x is the active open
  // cycle is x's ship (Round-3 amendments: a renamed branch carries the same commits).
  for (const cmd of ["node --test tests/*.test.mjs", "git status", "gh pr view 12"]) {
    assert.equal(decision(hook("pre-tool-use", bash(cmd))), "allow", cmd);
  }
  assert.match(reason(hook("pre-tool-use", bash("git push origin feature/y"))), /ship gate: specs\/x\/decision\.md does not exist/);
});

test("the ship gate reads the change NAME from the branch: praxis/xy is xy's record, never x's", () => {
  const { hook } = cycleRepo({ round: 1 });
  for (const cmd of ["git push origin praxis/xy", "git push -u origin praxis/x-old", "git push origin HEAD:praxis/xylophone", "/usr/bin/git push origin praxis/xy"]) {
    const out = hook("pre-tool-use", bash(cmd));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /no change record for praxis\/(xy|x-old|xylophone)/, "a praxis/<name> branch without a ledger does not ship, and is not judged by x's record");
    assert.doesNotMatch(reason(out), /specs\/x\/decision/);
  }
  for (const cmd of ["git push origin praxis/x", "git push origin praxis/x ", "git push origin praxis/x:praxis/x", 'git push origin "praxis/x"', "git push origin HEAD:praxis/x"]) {
    const out = hook("pre-tool-use", bash(cmd));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate: specs\/x\/decision\.md does not exist/);
  }
});

test("the ship gate reads the current branch when the push names no refspec, or HEAD", () => {
  const { repo, hook, write, commit } = cycleRepo({ round: 1 });
  write("src/a.js", "1\n");
  commit();
  execFileSync("git", ["checkout", "-q", "-b", "praxis/x"], { cwd: repo });
  for (const cmd of ["git push", "git push origin", "git push -u origin HEAD", "git push --force-with-lease origin HEAD"]) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", `${cmd} from praxis/x`);
    assert.match(reason(out), /ship gate: specs\/x\/decision\.md does not exist/);
  }
  assert.equal(decision(hook("pre-tool-use", bash("git push origin HEAD:feature/y", repo))), "deny", "HEAD: to another name still ships the change's commits");
  // Round 3: while x is the active open cycle, any other branch — from the change branch or off
  // it, or from a cwd git cannot read — is x's ship; with no open cycle it is free (the
  // "round 3: a PR or push off a branch outside any open cycle is free" test).
  assert.match(reason(hook("pre-tool-use", bash("git push origin feature/y", repo))), /ship gate: specs\/x\/decision\.md/);
  execFileSync("git", ["checkout", "-q", "-b", "feature/y"], { cwd: repo });
  assert.match(reason(hook("pre-tool-use", bash("git push", repo))), /ship gate: specs\/x\/decision\.md/);
  assert.match(reason(hook("pre-tool-use", bash("git push origin HEAD", repo))), /ship gate: specs\/x\/decision\.md/);
  const elsewhere = mkdtempSync(join(tmpdir(), "praxis-nogit-"));
  assert.match(reason(hook("pre-tool-use", bash("git push", elsewhere))), /ship gate: specs\/x\/decision\.md/, "no repo under cwd: the active open cycle still decides");
});

// The worktree flow makes `git -C <wt> push` and `cd <wt> && git push` the natural commands, and a
// substring match read neither: the first has no `git push` in it, the second's branch is not
// the one in the payload's cwd. The command is tokenized instead, and `-C` and `cd` move the
// directory the branch is read from.
test("the ship gate tokenizes the command: git -C and cd set the directory the branch is read from", () => {
  const { repo, hook, write, commit } = cycleRepo({ round: 1 });
  write("src/a.js", "1\n");
  commit();
  const wt = join(repo, ".praxis/worktrees/x");
  const other = join(repo, ".praxis/worktrees/other");
  execFileSync("git", ["worktree", "add", "-q", "-b", "praxis/x", wt], { cwd: repo });
  execFileSync("git", ["worktree", "add", "-q", "-b", "feature/y", other], { cwd: repo });
  const gated = [
    `git -C ${wt} push -u origin praxis/x`,
    `git -C ${wt} push -u origin HEAD`,
    `git -C "${wt}" push origin HEAD:praxis/x`,
    `git -C .praxis/worktrees/x push --force-with-lease origin HEAD`,
    `cd ${wt} && git push -u origin HEAD`,
    `cd ${wt}; git push`,
    `cd .praxis/worktrees/x && git status && git push`,
    `git -C ${wt} -c push.default=current push`,
    `GIT_TRACE=1 git -C ${wt} push`,
  ];
  for (const cmd of gated) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate/);
  }
  for (const cmd of [`git -C ${wt} log --oneline`, `echo "git push origin praxis/x"`]) {
    assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  }
  // Another branch's push, read from its own directory: not praxis/x, so it is the active open
  // cycle's ship (Round-3 amendments) — x's decision is what it waits for.
  for (const cmd of [`git -C ${other} push -u origin HEAD`, `cd ${other} && git push`, `git -C ${wt} status && git -C ${other} push`]) {
    assert.match(reason(hook("pre-tool-use", bash(cmd, repo))), /ship gate: specs\/x\/decision\.md/, cmd);
  }
});

// The host's project dir is the main checkout even when the builder works in its worktree.
// Without re-rooting, `<main>/.praxis/worktrees/x/src/a.ts` is `.praxis/…` — session state —
// and every gate is silent for the builder. The test runs the hook exactly as the host does:
// CLAUDE_PROJECT_DIR = main checkout, cwd = the worktree.
test("an edit inside the builder's worktree is judged by the worktree, not as the main checkout's session state", () => {
  const { repo, hook, write, commit } = floorRepo({ mode: "full" });
  write("README.md", "x\n");
  commit();
  write("specs/x/spec.md", "# x\n");
  write("specs/x/implementation.md", ledger("planned"));
  write(".praxis/active-change", "x\n");
  const wt = join(repo, ".praxis/worktrees/x");
  execFileSync("git", ["worktree", "add", "-q", "-b", "praxis/x", wt], { cwd: repo });
  const fromWt = (file_path) => hook("pre-tool-use", { tool_name: "Edit", cwd: wt, tool_input: { file_path } });

  // Nothing seeded: the floor applies to the worktree, and the worktree has no change open.
  let out = fromWt("src/x.ts");
  assert.equal(decision(out), "deny", "an unseeded worktree is not a free zone");
  assert.match(reason(out), /has no spec yet/);

  // What scripts/worktree.sh seeds, minus the marker: the spec is there, the approval is not.
  write(".praxis/worktrees/x/.praxis/active-change", "x\n");
  write(".praxis/worktrees/x/specs/x/spec.md", "# x\n");
  out = fromWt("src/x.ts");
  assert.equal(decision(out), "ask", "spec in the worktree, ledger in the main checkout, no marker: the one stop");
  assert.match(reason(out), /specs\/x\/spec\.md is written/);
  assert.equal(decision(fromWt(join(wt, "specs/x/spec.md"))), "allow", "the worktree's spec is spec-side");
  const forged = fromWt(join(wt, ".praxis/approved/x"));
  assert.equal(decision(forged), "deny", "the worktree's marker is still the person's");
  assert.match(reason(forged), /approval record/);

  // With the seeded marker the floor opens — for a relative path and an absolute one alike.
  write(".praxis/worktrees/x/.praxis/approved/x", "");
  assert.equal(decision(fromWt("src/x.ts")), "allow");
  assert.equal(decision(fromWt(join(wt, "src/x.ts"))), "allow");
  // The main checkout keeps its own state: no marker there, so an edit there still asks.
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "src/a.js")))), "ask");
});

// The discriminating form of the test above. "Seeded → allow" cannot tell a floor that passed
// from a floor that was skipped — a check that cannot fail is a GAP. So the worktree is the one
// scripts/worktree.sh really makes, and the floor is driven through all three answers by
// removing what it keys on: the marker (→ ask), then the spec (→ deny).
test("a worktree made by scripts/worktree.sh is judged by the floor: ask, allow and deny are all reachable", () => {
  const { repo, hook, write, commit, approve } = floorRepo({ mode: "full" });
  write("README.md", "x\n");
  commit();
  write("specs/x/spec.md", "# x\n");
  write("specs/x/implementation.md", ledger("planned"));
  write(".praxis/active-change", "x\n");
  approve("x");
  const made = spawnSync("bash", [join(ROOT, "scripts", "worktree.sh"), "x"], { cwd: repo, env: CLEAN, encoding: "utf8", timeout: 20_000 });
  assert.equal(made.status, 0, made.stderr);
  const wt = made.stdout.trimEnd().split("\n").at(-1);
  assert.ok(fsExists(join(wt, ".praxis/approved/x")), "worktree.sh seeds the marker — the test removes it on purpose");
  assert.ok(fsExists(join(wt, "specs/x/spec.md")), "worktree.sh seeds the spec");
  const forms = [join(wt, "src/a.js"), "src/a.js"];
  const fromWt = (file_path) => hook("pre-tool-use", { tool_name: "Edit", cwd: wt, tool_input: { file_path } });

  rmSync(join(wt, ".praxis/approved/x"));
  for (const path of forms) {
    const out = fromWt(path);
    assert.equal(decision(out), "ask", `${path}: no marker in the worktree must ask, not pass`);
    assert.match(reason(out), /specs\/x\/spec\.md is written/);
  }
  writeFileSync(join(wt, ".praxis/approved/x"), "");
  for (const path of forms) assert.equal(decision(fromWt(path)), "allow", path);

  rmSync(join(wt, ".praxis/approved/x"));
  rmSync(join(wt, "specs/x/spec.md"));
  for (const path of forms) {
    const out = fromWt(path);
    assert.equal(decision(out), "deny", `${path}: no spec in the worktree must deny`);
    assert.match(reason(out), /specs\/x\/spec\.md does not exist/);
  }
});

test("the ship gate: ESCALATE denies, APPROVE (human) allows, APPROVE needs every lens PASS", () => {
  const { repo, hook, write, lens, lensList, recordDecision } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests"]);
  lens(1, "correctness", "PASS");
  lens(1, "security", "PASS");
  lens(1, "tests", "PASS");
  // The approver's write as the host runs it: post-tool-use reads decision.md back and keeps
  // .praxis/ship/x in step with it (Round-3 amendments).
  const approverWrote = (verdict) => {
    recordDecision(verdict);
    hook("post-tool-use", { ...edit(join(repo, "specs/x/decision.md")), agent_id: "agent-a1", agent_type: "praxis:approver" });
  };
  // What scripts/approve.sh leaves on the override: the verdict and the ship marker.
  const personApproved = () => {
    recordDecision("APPROVE (human)");
    write(".praxis/ship/x", "");
  };

  approverWrote("ESCALATE");
  let out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /verdict ESCALATE/);
  assert.match(reason(out), /\/praxis:approve x/);

  personApproved();
  assert.equal(decision(hook("pre-tool-use", bash("gh pr create"))), "allow", "the human override ships");

  approverWrote("APPROVE");
  assert.equal(decision(hook("pre-tool-use", bash("git push origin praxis/x"))), "allow", "APPROVE + all PASS");

  lens(1, "security", "CHANGES");
  approverWrote("APPROVE");
  out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny", "APPROVE with one CHANGES does not ship");
  assert.match(reason(out), /lenses not all PASS/);
  assert.match(reason(out), /security: CHANGES/);
  personApproved();
  assert.equal(decision(hook("pre-tool-use", bash("gh pr create"))), "allow", "the human override ships whatever the lenses say");

  // A SKIP — the orchestrator's record of a lens that never returned — is not a PASS either.
  lens(1, "security", "SKIP");
  approverWrote("APPROVE");
  out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny", "APPROVE over a SKIP does not ship");
  assert.match(reason(out), /security: SKIP/);

  // APPROVE with no review round at all is not "round complete, all PASS".
  const unreviewed = cycleRepo({ round: 0 });
  unreviewed.recordDecision("APPROVE");
  out = unreviewed.hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /round is 0/);
});

test("a lens file with no verdict: line completes the barrier and counts as not PASS", () => {
  const { repo, hook, write, lens, lensList, recordDecision } = cycleRepo({ round: 2 });
  lensList(2, ["correctness", "security", "tests"]);
  lens(2, "security", "PASS");
  lens(2, "tests", "PASS");
  write("specs/x/review/round-2/correctness.md", "---\nlens: correctness\nround: 2\n---\n\n## Findings\n");
  // The file exists, so the barrier is not waiting — but nothing recorded PASS, so the cap bites.
  let out = hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /round cap/);
  assert.doesNotMatch(reason(out), /waiting for/);
  assert.match(reason(out), /correctness: no verdict/);
  recordDecision("APPROVE");
  out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /lenses not all PASS/);
  assert.match(reason(out), /correctness: no verdict/);
  assert.ok(fsExists(join(repo, "specs/x/review/round-2/correctness.md")));
});

test("a ledger with no round: or builder: field sits at round 0 with no builder to resume", () => {
  // The fields are the cycle's; a ledger that predates them (or an orchestrator that has not
  // set them yet) is read as "no review yet", and no SendMessage target can equal an empty id.
  const fixture = floorRepo({ mode: "full" });
  fixture.write("specs/x/spec.md", "# x\n");
  fixture.write("specs/x/implementation.md", ledger("planned"));
  fixture.write(".praxis/active-change", "x\n");
  fixture.approve("x");
  assert.equal(decision(fixture.hook("pre-tool-use", dispatchBuilder())), "allow");
  assert.equal(decision(fixture.hook("pre-tool-use", messageTo("agent-b1"))), "allow");
  assert.equal(decision(fixture.hook("pre-tool-use", messageTo(""))), "allow");
  // Such a ledger is not an open cycle (Round-3 amendments): a PR off a non-change branch is not
  // its ship. The praxis/x branch still is, and ships on its decision AND the ship marker — a
  // missing round: is never the way around the gate.
  assert.equal(decision(fixture.hook("pre-tool-use", bash("gh pr create"))), "allow", "a legacy ledger gates no unrelated PR");
  const out = fixture.hook("pre-tool-use", bash("git push origin praxis/x"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /decision\.md does not exist/);
  fixture.write("specs/x/decision.md", "---\nverdict: APPROVE (human)\n---\n");
  assert.match(reason(fixture.hook("pre-tool-use", bash("git push origin praxis/x"))), /\.praxis\/ship\/x does not exist/);
  fixture.write(".praxis/ship/x", "");
  assert.equal(decision(fixture.hook("pre-tool-use", bash("git push origin praxis/x"))), "allow");
});

test("the cycle gates: no ledger denies a builder, a PR off no change is free, PRAXIS_FLOOR=off lifts all, the dial does not", () => {
  const empty = floorRepo({ mode: "full" });
  let out = empty.hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny", "a builder outside any change is the cycle skipped, not a free build");
  assert.match(reason(out), /open the change first/);
  assert.equal(decision(empty.hook("pre-tool-use", bash("gh pr create"))), "allow", "a PR off no change branch, with no change open, is not a cycle ship");

  const capped = cycleRepo({ round: 2 });
  capped.lensList(2, ["correctness"]);
  capped.lens(2, "correctness", "CHANGES");
  assert.equal(decision(capped.hook("pre-tool-use", dispatchBuilder())), "deny", "the control");
  assert.equal(decision(capped.hook("pre-tool-use", bash("gh pr create"))), "deny", "the control");
  assert.equal(decision(capped.hook("pre-tool-use", dispatchBuilder(), { PRAXIS_FLOOR: "off" })), "allow");
  assert.equal(decision(capped.hook("pre-tool-use", bash("gh pr create"), { PRAXIS_FLOOR: "off" })), "allow");

  // The dial is a file the model can write from Bash; the gates key on the change's record,
  // not on it. A change with rounds and no decision does not ship in `fast` either.
  const fast = cycleRepo({ mode: "fast", round: 2 });
  fast.lensList(2, ["correctness"]);
  fast.lens(2, "correctness", "CHANGES");
  assert.equal(decision(fast.hook("pre-tool-use", dispatchBuilder())), "deny");
  assert.equal(decision(fast.hook("pre-tool-use", bash("gh pr create"))), "deny");
});

test("the floor keys on spec.md, and accepts a legacy design.md in its place", () => {
  const modern = floorRepo({ mode: "full" });
  modern.write("specs/x/spec.md", "# x\n");
  modern.write("specs/x/implementation.md", ledger("designed"));
  let out = modern.hook("pre-tool-use", edit(join(modern.repo, "src/a.js")));
  assert.equal(decision(out), "ask", "spec.md written, not yet approved: the one stop");
  assert.match(reason(out), /specs\/x\/spec\.md is written/);
  modern.approve("x");
  assert.equal(decision(modern.hook("pre-tool-use", edit(join(modern.repo, "src/a.js")))), "allow");

  const legacy = floorRepo({ mode: "full" });
  legacy.write("specs/x/design.md", "# x\n");
  legacy.write("specs/x/implementation.md", ledger("designed"));
  out = legacy.hook("pre-tool-use", edit(join(legacy.repo, "src/a.js")));
  assert.equal(decision(out), "ask");
  assert.match(reason(out), /specs\/x\/design\.md is written/, "the legacy file is named as what awaits approval");
  legacy.approve("x");
  assert.equal(decision(legacy.hook("pre-tool-use", edit(join(legacy.repo, "src/a.js")))), "allow");

  // post-tool-use records the approval for a spec.md change too.
  const post = floorRepo({ mode: "full" });
  post.write("specs/x/spec.md", "# x\n");
  post.write("specs/x/implementation.md", ledger("designed"));
  post.hook("post-tool-use", edit(join(post.repo, "src/a.js")));
  assert.ok(post.approved("x"), "the marker is written for a spec.md change");
});

test("a spec with no ledger is denied for the ledger, not for a spec it has", () => {
  const { repo, hook, write } = floorRepo({ mode: "full" });
  write("specs/x/spec.md", "# x\n");
  write(".praxis/active-change", "x\n");
  const out = hook("pre-tool-use", edit(join(repo, "src/a.js")));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /specs\/x\/implementation\.md does not exist \(specs\/x\/spec\.md does\)/);
  assert.match(reason(out), /Read specs\/_templates\/implementation\.md, then Write specs\/x\/implementation\.md/);
  assert.doesNotMatch(reason(out), /has no spec yet/, "the deny must name what is missing, not what is there");
});

// The builder works in a linked worktree (scripts/worktree.sh) that carries the spec and the
// markers but not the ledger — one ledger, in the main checkout, the orchestrator's. The floor
// still requires it; it reads it where the design put it.
test("from a linked worktree the floor reads the main checkout's ledger", () => {
  const { repo, hook, write, commit, approve } = floorRepo({ mode: "full" });
  write("README.md", "x\n");
  commit();
  write("specs/x/spec.md", "# x\n");
  write("specs/x/implementation.md", `---\ntitle: x\nstage: planned\nround: 0\nbuilder: agent-b1\n---\n\n## Tasks\n`);
  write(".praxis/active-change", "x\n");
  approve("x");
  const wt = join(repo, ".praxis/worktrees/x");
  execFileSync("git", ["worktree", "add", "-q", "-b", "praxis/x", wt], { cwd: repo });
  // What worktree.sh seeds: the spec and the markers, never the ledger.
  write(".praxis/worktrees/x/specs/x/spec.md", "# x\n");
  write(".praxis/worktrees/x/.praxis/active-change", "x\n");
  write(".praxis/worktrees/x/.praxis/approved/x", "");
  const inWorktree = (input) => hook("pre-tool-use", { ...input, cwd: wt }, { CLAUDE_PROJECT_DIR: wt });
  assert.equal(decision(inWorktree(edit(join(wt, "src/a.js")))), "allow", "spec + approval in the worktree, ledger in the main checkout");
  // The ledger's fields are read from there too: round 1 with a lens missing closes the barrier.
  write("specs/x/implementation.md", `---\ntitle: x\nstage: built\nround: 1\nbuilder: agent-b1\nlenses: correctness\n---\n`);
  const out = inWorktree(dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /barrier: waiting for correctness/);
  // Remove the main ledger and the floor closes: the fallback finds a ledger, it does not invent one.
  execFileSync("rm", [join(repo, "specs/x/implementation.md")]);
  const closed = inWorktree(edit(join(wt, "src/a.js")));
  assert.equal(decision(closed), "deny");
  assert.match(reason(closed), /specs\/x\/implementation\.md does not exist/);
});

test("post-tool-use writes .praxis/needs-human/<c> on ESCALATE and removes it on APPROVE", () => {
  const { repo, hook, recordDecision } = cycleRepo({ round: 2 });
  const marker = join(repo, ".praxis/needs-human/x");
  const wroteDecision = () => hook("post-tool-use", edit(join(repo, "specs/x/decision.md")));

  recordDecision("ESCALATE");
  assert.equal(wroteDecision().trim(), "", "post-tool-use never speaks");
  assert.ok(fsExists(marker), "ESCALATE must leave a record a hook can read");
  const ignore = fsRead(join(repo, ".praxis/.gitignore"), "utf8");
  assert.match(ignore, /^needs-human\/$/m, "a new project gets the full list");
  assert.match(ignore, /^worktrees\/$/m);
  assert.match(ignore, /^approved\/$/m);
  assert.match(ignore, /^active-change$/m);
  assert.match(ignore, /^session-started$/m);

  recordDecision("APPROVE (human)");
  wroteDecision();
  assert.ok(!fsExists(marker), "the human approval clears the escalation");

  recordDecision("ESCALATE");
  wroteDecision();
  assert.ok(fsExists(marker));
  recordDecision("APPROVE");
  wroteDecision();
  assert.ok(!fsExists(marker), "APPROVE clears it too");

  // Another change's decision is not the active change's record.
  const other = cycleRepo({ round: 1 });
  other.write("specs/y/decision.md", "---\nverdict: ESCALATE\n---\n");
  other.hook("post-tool-use", edit(join(other.repo, "specs/y/decision.md")));
  assert.ok(!fsExists(join(other.repo, ".praxis/needs-human/y")));
  assert.ok(!fsExists(join(other.repo, ".praxis/needs-human/x")));
});

test("the .praxis/.gitignore upgrade touches only a Praxis default; an edited file is the project's", () => {
  const escalate = (fixture) => {
    fixture.recordDecision("ESCALATE");
    fixture.hook("post-tool-use", edit(join(fixture.repo, "specs/x/decision.md")));
    return fsRead(join(fixture.repo, ".praxis/.gitignore"), "utf8");
  };
  // The two defaults earlier Praxis wrote, byte for byte: the new entries are appended after
  // their own lines, and a second pass changes nothing.
  for (const stale of ["active-change\napproved/\nsession-started\n", "active-change\napproved/\n"]) {
    const fixture = cycleRepo({ round: 2 });
    fixture.write(".praxis/.gitignore", stale);
    const ignore = escalate(fixture);
    assert.ok(ignore.startsWith(stale), `the default's own lines must come first, unchanged: ${JSON.stringify(ignore)}`);
    assert.match(ignore, /^needs-human\/$/m, `not upgraded from: ${JSON.stringify(stale)}`);
    assert.match(ignore, /^worktrees\/$/m);
    assert.equal(escalate(fixture), ignore, "the upgrade is idempotent");
  }
  // One edited character and the file is the project's: never rewritten.
  for (const mine of ["mine\n", "active-change\napproved/\nsession-started\nmine\n", "active-change\napproved/\n\n"]) {
    const fixture = cycleRepo({ round: 2 });
    fixture.write(".praxis/.gitignore", mine);
    assert.equal(escalate(fixture), mine, "a user-edited .gitignore was rewritten");
  }
});

test("pre-tool-use denies Edit/Write to the escalation record, in every mode", () => {
  for (const mode of ["fast", "full", "deep"]) {
    const { repo, hook } = floorRepo({ mode });
    const out = hook("pre-tool-use", { tool_name: "Write", tool_input: { file_path: join(repo, ".praxis/needs-human/x") } });
    assert.equal(decision(out), "deny", mode);
    assert.match(reason(out), /escalation record/);
    assert.match(reason(out), /never by the model/);
  }
});

test("the main thread may write a review file only with verdict: SKIP; a lens writes its own", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  const review = (content, extra = {}) =>
    ({ tool_name: "Write", tool_input: { file_path: join(repo, "specs/x/review/round-1/security.md"), content }, ...extra });
  const pass = "---\nlens: security\nround: 1\nverdict: PASS\n---\n";
  const skip = "---\nlens: security\nround: 1\nverdict: SKIP\n---\n## Reason\n- never returned\n";
  const out = hook("pre-tool-use", review(pass));
  assert.equal(decision(out), "deny", "a PASS the lens never wrote");
  assert.match(reason(out), /verdict: SKIP/);
  assert.equal(decision(hook("pre-tool-use", review(skip))), "allow");
  // The verdict the gates will read is the frontmatter one; a SKIP in the body does not count.
  const smuggled = "---\nlens: security\nround: 1\nverdict: PASS\n---\n\n## Reason\nverdict: SKIP\n";
  assert.equal(decision(hook("pre-tool-use", review(smuggled))), "deny", "a body line must not pass what the frontmatter fails");
  // Inside a subagent the payload carries agent_id (Claude Code hooks reference, common input
  // fields); the lens writes its own file freely.
  assert.equal(decision(hook("pre-tool-use", review(pass, { agent_id: "agent-l1", agent_type: "praxis:refuter-security" }))), "allow");
  // An Edit that flips a verdict from the main thread is caught the same way.
  const flip = { tool_name: "Edit", tool_input: { file_path: join(repo, "specs/x/review/round-1/security.md"), old_string: "verdict: SKIP", new_string: "verdict: PASS" } };
  assert.equal(decision(hook("pre-tool-use", flip)), "deny");
  // The main thread's own files stay free: the ledger, and the lens list written whole.
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "specs/x/implementation.md")))), "allow");
  const list = { tool_name: "Write", tool_input: { file_path: join(repo, "specs/x/review/round-1/lenses"), content: "correctness\nsecurity\ntests\n" } };
  assert.equal(decision(hook("pre-tool-use", list)), "allow", "the lens list is the orchestrator's file");
  // Codex puts no agent fields on PreToolUse, so there every write is the main thread's: a PASS
  // the main thread did not SKIP is denied, and the cycle on Codex ends in /praxis:approve.
  const env = { PLUGIN_ROOT: ROOT, PLUGIN_DATA: codexData(repo) };
  assert.equal(decision(hook("pre-tool-use", { ...review(pass), cwd: repo }, env)), "deny");
});

// ── Round-1 review hardening: who writes which record, and what a ship is ─────────────────────
//
// specs/factory-cycle/review/round-1/{security,correctness,tests}.md. One principle: deny what
// the model can write, record what only the person can do. Every probe the lenses ran that came
// back "allowed" is a case below that must come back "deny".

const asRole = (payload, agent_type, agent_id = "agent-r1") => ({ ...payload, agent_id, agent_type });
const writeFile = (repo, rel, content) => ({ tool_name: "Write", tool_input: { file_path: join(repo, rel), content } });
const decisionDoc = (verdict) => `---\nverdict: ${verdict}\nround: 1\n---\n\n## Checks run\n- x → y\n## Reason\n`;

test("decision.md: never the main thread, only the approver, and APPROVE (human) is the script's alone", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  for (const verdict of ["APPROVE", "ESCALATE", "APPROVE (human)"]) {
    const out = hook("pre-tool-use", writeFile(repo, "specs/x/decision.md", decisionDoc(verdict)));
    assert.equal(decision(out), "deny", `the main thread wrote ${verdict}`);
    assert.match(reason(out), /scripts\/approve\.sh/);
  }
  let out = hook("pre-tool-use", asRole(writeFile(repo, "specs/x/decision.md", decisionDoc("APPROVE")), "praxis:builder"));
  assert.equal(decision(out), "deny", "a builder is not the approver");
  assert.match(reason(out), /only by the approver/);
  assert.equal(decision(hook("pre-tool-use", asRole(writeFile(repo, "specs/x/decision.md", decisionDoc("APPROVE")), "praxis:approver"))), "allow");
  assert.equal(decision(hook("pre-tool-use", asRole(writeFile(repo, "specs/x/decision.md", decisionDoc("ESCALATE")), "approver"))), "allow");
  out = hook("pre-tool-use", asRole(writeFile(repo, "specs/x/decision.md", decisionDoc("APPROVE (human)")), "praxis:approver"));
  assert.equal(decision(out), "deny", "the person's verdict is not the approver's to write");
  assert.match(reason(out), /scripts\/approve\.sh/);
  // Below the frontmatter, or added by an Edit: still the person's words.
  assert.equal(decision(hook("pre-tool-use", asRole(writeFile(repo, "specs/x/decision.md", `${decisionDoc("APPROVE")}APPROVE (human)\n`), "praxis:approver"))), "deny");
  const flip = { tool_name: "Edit", tool_input: { file_path: join(repo, "specs/x/decision.md"), old_string: "verdict: APPROVE", new_string: "verdict: APPROVE (human)" } };
  assert.equal(decision(hook("pre-tool-use", asRole(flip, "praxis:approver"))), "deny");
});

test(".praxis/active-change cannot silence the gates: the ship keys on the pushed branch, the builder on a real ledger", () => {
  const { hook, write, lens, lensList, recordDecision } = cycleRepo({ round: 2 });
  lensList(2, ["correctness", "security", "tests"]);
  lens(2, "correctness", "CHANGES");
  lens(2, "security", "PASS");
  lens(2, "tests", "PASS");
  recordDecision("ESCALATE");
  write(".praxis/active-change", "nope\n");
  let out = hook("pre-tool-use", bash("git push origin praxis/x"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /verdict ESCALATE/, "x's own record is read, whatever active-change says");
  out = hook("pre-tool-use", bash("git push origin praxis/ghost"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /no change record for praxis\/ghost/);
  // Round 3: x is at the cap, and the cap is read over every open cycle, not through the pointer.
  out = hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /round cap/);
  out = hook("pre-tool-use", messageTo("agent-b1"));
  assert.equal(decision(out), "deny", "the builder id is found in x's ledger, not through active-change");
  assert.match(reason(out), /round cap/);
  // With no change at the cap, a pointer to a change that does not exist opens nothing.
  const open = cycleRepo({ round: 0 });
  open.write(".praxis/active-change", "nope\n");
  assert.match(reason(open.hook("pre-tool-use", dispatchBuilder())), /open the change first/);
});

test("the ship gate reads refspecs by their source, strips redirections, unwraps wrappers and nested shells", () => {
  const { repo, hook, write, commit } = cycleRepo({ round: 1 });
  write("src/a.js", "1\n");
  commit();
  execFileSync("git", ["checkout", "-q", "-b", "praxis/x"], { cwd: repo });
  const gated = [
    "git push origin praxis/x:main", "git push origin +praxis/x:main", "git push origin refs/heads/praxis/x",
    "git push origin refs/heads/praxis/x:refs/heads/praxis/x",
    "git push origin 2>&1", "git push origin >/dev/null", "git push origin praxis/x 2>/dev/null", "git push origin >>log 2>&1",
    "env GIT_TRACE=1 git push origin praxis/x", "sudo git push origin praxis/x", "command git push origin praxis/x",
    "time git push origin praxis/x", "nohup git push origin praxis/x", "nice -n 5 git push origin praxis/x",
    "/usr/bin/git push origin praxis/x", "(git push origin praxis/x)", "{ git push origin praxis/x; }",
    'bash -c "git push origin praxis/x"', "sh -c 'cd . && git push origin HEAD'", 'eval "git push origin praxis/x"',
    "gh -R o/r pr create --fill", "gh pr merge 12", "gh api repos/o/r/pulls -f head=praxis/x", "gh api -X PUT repos/o/r/pulls/12/merge",
    "git push --all origin", "git push --mirror origin",
  ];
  for (const cmd of gated) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate/, cmd);
  }
  assert.match(reason(hook("pre-tool-use", bash("git push --all origin", repo))), /Push the branch explicitly/);
  const free = [
    "echo 'git push origin praxis/x'", "sh -c 'echo git push origin praxis/x'", "gh pr view 12", "gh api repos/o/r/issues",
    "git -C /tmp log --oneline", "git push origin :praxis/x",
  ];
  for (const cmd of free) assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  // Round 3: another branch pushed while x is the active open cycle is x's ship, redirections or not.
  for (const cmd of ["git push origin main:feature/y", "git push origin feature/y 2>&1"]) {
    assert.match(reason(hook("pre-tool-use", bash(cmd, repo))), /ship gate: specs\/x\/decision\.md/, cmd);
  }
});

test("review files are role-bound: a lens writes its own file, a builder none; the list and the ledger are the orchestrator's", () => {
  const { repo, hook, lens } = cycleRepo({ round: 1 });
  const review = (name, verdict) =>
    writeFile(repo, `specs/x/review/round-1/${name}.md`, `---\nlens: ${name}\nround: 1\nverdict: ${verdict}\n---\n## What I tried to break\n- a → b\n`);
  let out = hook("pre-tool-use", asRole(review("security", "PASS"), "praxis:builder"));
  assert.equal(decision(out), "deny", "a builder does not write reviews");
  assert.match(reason(out), /only by its own lens/);
  assert.equal(decision(hook("pre-tool-use", asRole(review("correctness", "PASS"), "praxis:refuter-security"))), "deny", "a lens does not write another lens's file");
  assert.equal(decision(hook("pre-tool-use", asRole(review("security", "CHANGES"), "praxis:refuter-security"))), "allow");
  assert.equal(decision(hook("pre-tool-use", asRole(review("ui", "PASS"), "lens-ui"))), "allow");
  assert.equal(decision(hook("pre-tool-use", asRole(review("tests", "PASS"), "refuter-tests"))), "allow");

  const list = (names) => writeFile(repo, "specs/x/review/round-1/lenses", `${names.join("\n")}\n`);
  assert.equal(decision(hook("pre-tool-use", asRole(list(["correctness", "security", "tests"]), "praxis:builder"))), "deny", "a subagent does not write the list");
  out = hook("pre-tool-use", list(["correctness", "security"]));
  assert.equal(decision(out), "deny", "dropping a lens is not how a round passes");
  assert.match(reason(out), /missing: tests/);
  assert.equal(decision(hook("pre-tool-use", list(["correctness", "security", "tests", "ui"]))), "allow");
  lens(1, "correctness", "PASS");
  out = hook("pre-tool-use", list(["security", "tests", "correctness"]));
  assert.equal(decision(out), "deny", "the list is pinned once the round holds a review");
  assert.match(reason(out), /pinned/);

  const ledgerAt = (round) =>
    writeFile(repo, "specs/x/implementation.md", `---\ntitle: x\nstage: built\nround: ${round}\nbuilder: agent-b1\nlenses: correctness, security, tests\n---\n`);
  assert.equal(decision(hook("pre-tool-use", asRole(ledgerAt(1), "praxis:engineer"))), "deny", "a subagent does not write the ledger");
  out = hook("pre-tool-use", ledgerAt(0));
  assert.equal(decision(out), "deny", "the round never goes down from the model");
  assert.match(reason(out), /lower than the current round 1/);
  assert.match(reason(out), /rework/);
  assert.equal(decision(hook("pre-tool-use", ledgerAt(1))), "allow");
  assert.equal(decision(hook("pre-tool-use", ledgerAt(2))), "allow");
  assert.equal(decision(hook("pre-tool-use", edit(join(repo, "specs/x/implementation.md")))), "allow", "an Edit that does not touch round: is free");
});

test("records are classified case-insensitively: .Praxis/Approved/x IS the marker on the default macOS volume", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  for (const rel of [".Praxis/Approved/x", ".PRAXIS/needs-human/x", ".praxis/Intent/approve-x"]) {
    const out = hook("pre-tool-use", writeFile(repo, rel, ""));
    assert.equal(decision(out), "deny", rel);
    assert.match(reason(out), /record|token/);
  }
  const out = hook("pre-tool-use", writeFile(repo, "SPECS/x/Decision.md", decisionDoc("APPROVE")));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /approver/);
});

test("approve.sh and rework.sh run only on the person's one-shot token: minted by the prompt, consumed by the run", () => {
  const { repo, hook } = cycleRepo({ round: 2 });
  const token = join(repo, ".praxis/intent/approve-x");
  let out = hook("pre-tool-use", bash("bash scripts/approve.sh x", repo));
  assert.equal(decision(out), "deny", "no prompt, no token");
  assert.match(reason(out), /typed by the person — \/praxis:approve x/);
  hook("user-prompt-submit", { prompt: "/praxis:approve x" });
  assert.ok(fsExists(token), "the person's prompt mints the token");
  assert.equal(decision(hook("pre-tool-use", bash('bash "${CLAUDE_PLUGIN_ROOT}/scripts/approve.sh" x', repo))), "allow");
  assert.equal(decision(hook("pre-tool-use", bash("bash scripts/approve.sh other", repo))), "deny", "the token names its change");
  hook("post-tool-use", bash("bash scripts/approve.sh x", repo));
  assert.ok(!fsExists(token), "consumed by the run");
  assert.equal(decision(hook("pre-tool-use", bash("bash scripts/approve.sh x", repo))), "deny", "one prompt, one run");
  // rework takes the same path; a prompt that merely mentions the command mints nothing.
  hook("user-prompt-submit", { prompt: "please run /praxis:rework x later" });
  assert.ok(!fsExists(join(repo, ".praxis/intent/rework-x")));
  hook("user-prompt-submit", { prompt: '/praxis:rework x "tighten the parser"' });
  assert.ok(fsExists(join(repo, ".praxis/intent/rework-x")));
  assert.equal(decision(hook("pre-tool-use", bash('scripts/rework.sh x "tighten the parser"', repo))), "allow");
  // The token and the markers are not the model's from any tool: Edit/Write and Bash writes are
  // denied, reads are not.
  assert.equal(decision(hook("pre-tool-use", writeFile(repo, ".praxis/intent/approve-x", ""))), "deny");
  for (const cmd of ["touch .praxis/approved/x", "mkdir -p .praxis/intent && touch .praxis/intent/approve-x", "echo x > .praxis/needs-human/x", "rm .praxis/needs-human/x", "cp a .praxis/approved/x"]) {
    out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /record the model does not write/);
  }
  for (const cmd of ["ls .praxis/approved", "cat .praxis/needs-human/x", "test -f .praxis/approved/x && echo yes"]) {
    assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  }
});

test("NotebookEdit is a write: the floor applies to a notebook, and the matchers carry it", () => {
  const { repo, hook } = floorRepo({ mode: "full" });
  const out = hook("pre-tool-use", { tool_name: "NotebookEdit", tool_input: { notebook_path: join(repo, "nb/a.ipynb"), new_source: "x" } });
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /nb\/a\.ipynb/);
  const cfg = JSON.parse(readFileSync(join(ROOT, "hooks/hooks.json"), "utf8")).hooks;
  assert.ok(cfg.PreToolUse[0].matcher.split("|").includes("NotebookEdit"));
  assert.ok(cfg.PostToolUse[0].matcher.split("|").includes("NotebookEdit"));
  assert.ok(cfg.PostToolUse[0].matcher.split("|").includes("Bash"), "post-tool-use consumes the command token after a Bash run");
});

test("while a round is open, any write-capable dispatch is a builder resume: engineer, backend, design, platform", () => {
  const { hook, lensList, lens } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests"]);
  lens(1, "security", "PASS");
  lens(1, "tests", "PASS");
  for (const kind of ["engineer", "praxis:backend", "design", "platform"]) {
    const out = hook("pre-tool-use", dispatchBuilder(kind));
    assert.equal(decision(out), "deny", kind);
    assert.match(reason(out), /barrier: waiting for correctness/);
  }
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder("praxis:refuter-correctness"))), "allow", "a lens is not a builder");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder("researcher"))), "allow");
  lens(1, "correctness", "PASS");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder("engineer"))), "allow");
  const idle = cycleRepo({ round: 0 });
  assert.equal(decision(idle.hook("pre-tool-use", dispatchBuilder("engineer"))), "allow", "no round open: the fast path is free");
});

test("the round is read from disk too: review folders, leading zeros and CRLF cannot reopen the cap", () => {
  const { hook, write, lens, lensList } = cycleRepo({ round: 0 });
  lensList(2, ["correctness", "security", "tests"]);
  lens(2, "correctness", "CHANGES");
  lens(2, "security", "PASS");
  lens(2, "tests", "PASS");
  let out = hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny", "round-2 holds a review: the cap counts it whatever round: says");
  assert.match(reason(out), /round cap/);
  write("specs/x/implementation.md", "---\ntitle: x\nstage: built\nround: 02\nbuilder: agent-b1\nlenses: correctness\n---\n");
  assert.match(reason(hook("pre-tool-use", messageTo("agent-b1"))), /round cap/, "02 is two, not an octal error that opens the gate");
  write("specs/x/implementation.md", "---\r\ntitle: x\r\nstage: built\r\nround: 2\r\nbuilder: agent-b1\r\nlenses: correctness\r\n---\r\n");
  assert.match(reason(hook("pre-tool-use", messageTo("agent-b1"))), /round cap/, "a CRLF ledger reads like an LF one");
  write("specs/x/review/round-2/correctness.md", "---\r\nlens: correctness\r\nround: 2\r\nverdict: PASS\r\n---\r\n## What I tried to break\r\n- a → b\r\n");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow", "a CRLF PASS is a PASS, not an over-block");
});

test("a PASS without 'What I tried to break' is a SKIP for the gates: no ship, but the fix round still opens", () => {
  const { repo, hook, write, lens, lensList, recordDecision } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests"]);
  lens(1, "security", "PASS");
  lens(1, "tests", "PASS");
  // The approver's write, as the host runs it: post-tool-use keeps .praxis/ship/x in step.
  const approverWrote = () => {
    recordDecision("APPROVE");
    hook("post-tool-use", { ...edit(join(repo, "specs/x/decision.md")), agent_id: "agent-a1", agent_type: "praxis:approver" });
  };
  write("specs/x/review/round-1/correctness.md", "---\nlens: correctness\nround: 1\nverdict: PASS\n---\n## Findings\n");
  approverWrote();
  let out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /correctness: PASS without attack list/);
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow", "round 1: the fix round");
  write("specs/x/review/round-1/correctness.md", "---\nlens: correctness\nround: 1\nverdict: PASS\n---\n## What I tried to break\n\n## Notes\n- not evidence\n");
  approverWrote();
  assert.match(reason(hook("pre-tool-use", bash("gh pr create"))), /without attack list/, "the heading alone, with no bullet, is not evidence");
  write("specs/x/review/round-1/correctness.md", "---\nlens: correctness\nround: 1\nverdict: PASS\n---\n## What I tried to break\n- a → b\n");
  approverWrote();
  assert.equal(decision(hook("pre-tool-use", bash("gh pr create"))), "allow");
});

test("SendMessage with no builder: recorded while a round is open is denied, not waved through", () => {
  const open = cycleRepo({ round: 1, builder: "" });
  const out = open.hook("pre-tool-use", messageTo("agent-whoever"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /record 'builder: <id>'/);
  const idle = cycleRepo({ round: 0, builder: "" });
  assert.equal(decision(idle.hook("pre-tool-use", messageTo("agent-whoever"))), "allow");
  const shipped = cycleRepo({ round: 1, builder: "" });
  shipped.write("specs/x/implementation.md", "---\ntitle: x\nstage: shipped\nround: 1\nbuilder:\nlenses: correctness\n---\n");
  assert.equal(decision(shipped.hook("pre-tool-use", messageTo("agent-whoever"))), "allow", "a shipped change has no round open");
});

test("an empty lens list is never all-PASS: the function itself, and the ship gate over zero reviews", () => {
  const { repo, hook, recordDecision } = cycleRepo({ round: 1, lenses: "" });
  recordDecision("APPROVE");
  const out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny", "APPROVE over zero reviews does not ship");
  // Round 3: no list is the three required lenses, all missing.
  assert.match(reason(out), /correctness: missing security: missing tests: missing/);
  const probe = spawnSync("bash", ["-c", `. "${join(ROOT, "hooks/lib.sh")}"; praxis_round_all_pass "$1" x 1; echo "all_pass=$?"`, "_", repo], { encoding: "utf8" });
  assert.match(probe.stdout, /all_pass=1/, "praxis_round_all_pass must be false on an empty list (mutant M2)");
});

test("a lens name carrying a slash is dropped from the list, and a verdict outside the frontmatter is no verdict", () => {
  const { hook, write, lensList, lens, recordDecision } = cycleRepo({ round: 1 });
  lensList(1, ["correctness", "security", "tests", "../../x"]);
  for (const name of ["correctness", "security", "tests"]) lens(1, name, "PASS");
  assert.equal(decision(hook("pre-tool-use", dispatchBuilder())), "allow", "only the three count, and they passed");
  write("specs/x/review/round-1/correctness.md", "---\nlens: correctness\nround: 1\n---\nverdict: PASS\n## What I tried to break\n- a\n");
  recordDecision("APPROVE");
  const out = hook("pre-tool-use", bash("gh pr create"));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /correctness: no verdict/, "a frontmatter block without verdict: is not rescued by a body line");
});

test("post-tool-use records the decision of the active change only, in every mode", () => {
  const fast = cycleRepo({ mode: "fast", round: 2 });
  fast.recordDecision("ESCALATE");
  fast.hook("post-tool-use", edit(join(fast.repo, "specs/x/decision.md")));
  assert.ok(fsExists(join(fast.repo, ".praxis/needs-human/x")), "the verdict is a fact about the change, not about the dial");
  const { repo, hook, write, recordDecision } = cycleRepo({ round: 2 });
  recordDecision("ESCALATE");
  write("specs/y/decision.md", "---\nverdict: ESCALATE\n---\n");
  hook("post-tool-use", edit(join(repo, "specs/y/decision.md")));
  assert.ok(!fsExists(join(repo, ".praxis/needs-human/x")), "another change's decision.md is not x's record, even with x's own ESCALATE on disk");
  assert.ok(!fsExists(join(repo, ".praxis/needs-human/y")));
});

test("SKIP at round 1 lets the builder resume for the other lenses' CHANGES; at round 2 it is the cap", () => {
  const one = cycleRepo({ round: 1 });
  one.lensList(1, ["correctness", "security", "tests"]);
  one.lens(1, "correctness", "CHANGES");
  one.lens(1, "security", "SKIP");
  one.lens(1, "tests", "PASS");
  assert.equal(decision(one.hook("pre-tool-use", dispatchBuilder())), "allow");
  const two = cycleRepo({ round: 2 });
  two.lensList(2, ["correctness", "security", "tests"]);
  two.lens(2, "correctness", "PASS");
  two.lens(2, "security", "SKIP");
  two.lens(2, "tests", "PASS");
  const out = two.hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /security: SKIP/);
});

test("the PreToolUse matcher reaches every tool the cycle gates read", () => {
  const claudeMatcher = JSON.parse(readFileSync(join(ROOT, "hooks/hooks.json"), "utf8")).hooks.PreToolUse[0].matcher.split("|");
  for (const tool of ["Edit", "Write", "MultiEdit", "Agent", "SendMessage", "Bash"]) {
    assert.ok(claudeMatcher.includes(tool), `hooks.json PreToolUse misses ${tool}`);
  }
  // Codex reports its shell as `Bash` and `spawn_agent` as `Agent`; it has no SendMessage.
  const codexMatcher = JSON.parse(readFileSync(join(ROOT, "hooks/hooks-codex.json"), "utf8")).hooks.PreToolUse[0].matcher.split("|");
  for (const tool of ["apply_patch", "Agent", "Bash"]) {
    assert.ok(codexMatcher.includes(tool), `hooks-codex.json PreToolUse misses ${tool}`);
  }
});

// ── Round 3 (rework 1): the drift threat model, ADR-007 ─────────────────────────────────────────
//
// specs/factory-cycle/design.md "Round-3 amendments"; the findings are
// specs/factory-cycle/review/rework-1/round-2/{security,correctness,tests}.md. Each case is either
// a direct spelling a lens produced that came back "allow", or an honest command a round-2 rule
// denied. Spellings that need a shell parser (aliases, $(…), variables, wrapper scripts,
// interpreters) are listed as open in the pre-tool-use header and are not pinned here.

const LENSES = ["correctness", "security", "tests"];
const allPass = (fx, r) => {
  fx.lensList(r, LENSES);
  for (const name of LENSES) fx.lens(r, name, "PASS");
};
// The approver's decision as the host runs it: pre-tool-use lets the approver write, the file
// lands, post-tool-use reads it back. The fixture writes the file; the hooks see the same payload.
const approverWrites = (fx, verdict, round = 1) => {
  const payload = asRole(writeFile(fx.repo, "specs/x/decision.md", decisionDoc(verdict)), "praxis:approver");
  assert.equal(decision(fx.hook("pre-tool-use", payload)), "allow", `the approver writes ${verdict}`);
  fx.recordDecision(verdict, round);
  fx.hook("post-tool-use", payload);
};
const shipMarker = (fx, c = "x") => join(fx.repo, ".praxis/ship", c);
const onBranch = (fx, branch) => {
  fx.write("README.md", "x\n");
  fx.commit();
  execFileSync("git", ["checkout", "-q", "-b", branch], { cwd: fx.repo });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: fx.repo, encoding: "utf8" }).trim();
};
// A project that adopted Praxis before the cycle: a ledger with no round:, no builder:, no review/.
const legacyRepo = ({ active = true } = {}) => {
  const fx = floorRepo({ mode: "full" });
  fx.write("specs/old/design.md", "# old\n");
  fx.write("specs/old/implementation.md", ledger("implemented"));
  if (active) fx.write(".praxis/active-change", "old\n");
  fx.approve("old");
  return fx;
};

test("round 3: a PR or push off a branch outside any open cycle is free — legacy ledgers, no active change, a shipped cycle", () => {
  for (const active of [true, false]) {
    const fx = legacyRepo({ active });
    onBranch(fx, "feature/y");
    for (const cmd of ["gh pr create --base main", "gh pr create --fill", "git push -u origin feature/y", "git push"]) {
      assert.equal(decision(fx.hook("pre-tool-use", bash(cmd, fx.repo))), "allow", `${cmd} (active-change written: ${active})`);
    }
  }
  const fast = legacyRepo();
  fast.hook("user-prompt-submit", { prompt: "/praxis fast" });
  assert.equal(decision(fast.hook("pre-tool-use", bash("gh pr create --base main", fast.repo))), "allow", "fast mode, legacy ledger");
  // stage: shipped with the ship marker closes the cycle: the next, unrelated PR is not its business.
  const shipped = cycleRepo({ round: 1 });
  shipped.write("specs/x/implementation.md", "---\ntitle: x\nstage: shipped\nround: 1\nbuilder: agent-b1\n---\n");
  shipped.write(".praxis/ship/x", "");
  onBranch(shipped, "feature/y");
  assert.equal(decision(shipped.hook("pre-tool-use", bash("gh pr create --base main", shipped.repo))), "allow");
});

test("round 3: while the active change is an open cycle, a PR or push off any other branch is that change's ship", () => {
  const fx = cycleRepo({ round: 1 });
  onBranch(fx, "shipit");
  for (const cmd of [
    "gh pr create --base main", "git push origin shipit", "git push -u origin HEAD", "git push",
    "git switch -c shipit2 && git push origin shipit2", "gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'",
  ]) {
    const out = fx.hook("pre-tool-use", bash(cmd, fx.repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate: specs\/x\/decision\.md does not exist/, cmd);
  }
  // A cycle starts with a recorded builder, a round of 1 or more, or a review folder. The
  // template's round 0 alone is not one (Round-3 amendments, lens round 1).
  const fresh = floorRepo({ mode: "full" });
  fresh.write("specs/x/spec.md", "# x\n");
  fresh.write("specs/x/implementation.md", "---\ntitle: x\nstage: planned\nround: 0\n---\n");
  fresh.write(".praxis/active-change", "x\n");
  assert.equal(decision(fresh.hook("pre-tool-use", bash("gh pr create --base main", fresh.repo))), "allow", "round: 0 alone is the template, not a cycle");
  const reviewed = floorRepo({ mode: "full" });
  reviewed.write("specs/x/spec.md", "# x\n");
  reviewed.write("specs/x/implementation.md", ledger("built"));
  reviewed.write("specs/x/review/round-1/lenses", "correctness\nsecurity\ntests\n");
  reviewed.write(".praxis/active-change", "x\n");
  assert.equal(decision(reviewed.hook("pre-tool-use", bash("gh pr create --base main", reviewed.repo))), "deny", "a review/ folder is an open cycle");
});

test("round 3: the ship gate needs .praxis/ship/<c> — a decision.md forged outside the approver ships nothing", () => {
  const fx = cycleRepo({ round: 1 });
  allPass(fx, 1);
  for (const verdict of ["APPROVE", "APPROVE (human)"]) {
    fx.recordDecision(verdict); // what `printf … > specs/x/decision.md` leaves on disk: no hook saw it
    for (const cmd of ["git push origin praxis/x", "gh pr create --head praxis/x"]) {
      const out = fx.hook("pre-tool-use", bash(cmd, fx.repo));
      assert.equal(decision(out), "deny", `${verdict} forged: ${cmd}`);
      assert.match(reason(out), /\.praxis\/ship\/x/, "the deny names the record that is missing");
    }
  }
  approverWrites(fx, "APPROVE");
  assert.ok(fsExists(shipMarker(fx)), "post-tool-use writes the marker for APPROVE over a complete all-PASS round");
  for (const cmd of ["git push origin praxis/x", "gh pr create --head praxis/x"]) {
    assert.equal(decision(fx.hook("pre-tool-use", bash(cmd, fx.repo))), "allow", cmd);
  }
  // The marker alone is not enough either: the decision must still say APPROVE.
  fx.recordDecision("ESCALATE");
  assert.equal(decision(fx.hook("pre-tool-use", bash("git push origin praxis/x", fx.repo))), "deny");
});

test("round 3: post-tool-use writes the ship marker only for APPROVE over a complete all-PASS round; ESCALATE removes it", () => {
  const fx = cycleRepo({ round: 1 });
  fx.lensList(1, LENSES);
  fx.lens(1, "correctness", "PASS");
  fx.lens(1, "security", "CHANGES");
  fx.lens(1, "tests", "PASS");
  approverWrites(fx, "APPROVE");
  assert.ok(!fsExists(shipMarker(fx)), "APPROVE over a CHANGES round writes no marker");
  const out = fx.hook("pre-tool-use", bash("git push origin praxis/x", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /security: CHANGES/, "the deny says why the approver's APPROVE wrote no marker");
  fx.lens(1, "security", "PASS");
  approverWrites(fx, "APPROVE");
  assert.ok(fsExists(shipMarker(fx)));
  approverWrites(fx, "ESCALATE");
  assert.ok(!fsExists(shipMarker(fx)), "ESCALATE takes the ship marker back");
  assert.ok(fsExists(join(fx.repo, ".praxis/needs-human/x")));
  const zero = cycleRepo({ round: 0 });
  approverWrites(zero, "APPROVE", 0);
  assert.ok(!fsExists(shipMarker(zero)), "no review round, no marker");
});

test("round 3: the cycle never pushes trunk — main, master and the ledger's base:, case-folded, from any source", () => {
  const fx = cycleRepo({ round: 1 });
  fx.write("specs/x/implementation.md", "---\ntitle: x\nstage: built\nround: 1\nbuilder: agent-b1\nbase: Develop\nlenses: correctness, security, tests\n---\n");
  const sha = onBranch(fx, "praxis/x");
  allPass(fx, 1);
  approverWrites(fx, "APPROVE"); // even a change that may ship never ships by pushing trunk
  const trunk = [
    "git push origin HEAD:main", "git push origin Praxis/x:refs/heads/Main", `git push origin ${sha}:main`,
    `git push origin ${sha.slice(0, 8)}:refs/heads/MASTER`, "git push origin praxis/x~0:main", "git push origin x:refs/heads/Main",
    "git push origin HEAD:develop", "git push origin +HEAD:DEVELOP", "git push origin :main", "git push origin main",
    "git push origin --delete master", "gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc",
  ];
  for (const cmd of trunk) {
    const out = fx.hook("pre-tool-use", bash(cmd, fx.repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /never pushes trunk/, cmd);
  }
  for (const cmd of ["git push --all origin", "git push --mirror origin", "git push --branches origin"]) {
    const out = fx.hook("pre-tool-use", bash(cmd, fx.repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /Push the branch explicitly/, cmd);
  }
  assert.equal(decision(fx.hook("pre-tool-use", bash("git push origin praxis/x", fx.repo))), "allow", "the change branch itself ships");

  // An open cycle anywhere counts, whatever .praxis/active-change names.
  const mixed = cycleRepo({ round: 1 });
  mixed.write("specs/old/design.md", "# old\n");
  mixed.write("specs/old/implementation.md", ledger("implemented"));
  mixed.write(".praxis/active-change", "old\n");
  onBranch(mixed, "feature/y");
  for (const cmd of ["git push origin HEAD:main", "git push --all origin"]) {
    assert.equal(decision(mixed.hook("pre-tool-use", bash(cmd, mixed.repo))), "deny", `${cmd} with x open and active-change elsewhere`);
  }

  // No open cycle: not Praxis's call.
  const legacy = legacyRepo();
  const legacySha = onBranch(legacy, "feature/y");
  for (const cmd of [
    "git push origin HEAD:main", `git push origin ${legacySha}:main`, "git push origin x:refs/heads/Main", "git push origin main",
    "git push --all origin", "git push --mirror origin", "git push --branches origin",
  ]) {
    assert.equal(decision(legacy.hook("pre-tool-use", bash(cmd, legacy.repo))), "allow", `${cmd} with no open cycle`);
  }
});

test("round 3: the tokenizer reads keywords, backslashes, timeout, combined shell flags, xargs and find -exec", () => {
  const fx = cycleRepo({ round: 1 });
  onBranch(fx, "praxis/x");
  const gated = [
    "git \\push origin praxis/x", "git p\\ush origin praxis/x", "\\git push origin praxis/x",
    "timeout 60 git push origin praxis/x", "timeout -s KILL 5 git push origin praxis/x",
    "if true; then git push origin praxis/x; fi", "if false; then :; else git push origin praxis/x; fi",
    "for i in 1; do git push origin praxis/x; done", "until git push origin praxis/x; do :; done", "! git push origin praxis/x",
    "bash -lc 'git push origin praxis/x'", 'sh -ec "git push origin praxis/x"', "zsh -xc 'git push origin praxis/x'",
    "bash <<< 'git push origin praxis/x'", "stdbuf -oL git push origin praxis/x", "setsid git push origin praxis/x",
    "echo x | xargs git push origin praxis/x", "find . -maxdepth 0 -exec git push origin praxis/x \\;",
  ];
  for (const cmd of gated) {
    const out = fx.hook("pre-tool-use", bash(cmd, fx.repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /ship gate/, cmd);
  }
  for (const cmd of ["echo then git push origin praxis/x", "printf '%s\\n' 'git push origin praxis/x'", "rg -n 'git push' docs", "git log --oneline", "git push --tags origin"]) {
    assert.equal(decision(fx.hook("pre-tool-use", bash(cmd, fx.repo))), "allow", cmd);
  }
});

test("round 3: what a ship names — gh --head, gh api merges, a nested name, the refspec source over its destination", () => {
  const fx = cycleRepo({ round: 1 });
  allPass(fx, 1);
  approverWrites(fx, "APPROVE"); // x may ship; every deny below is about another name
  let out = fx.hook("pre-tool-use", bash("gh pr create --base main --head praxis/y", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /no change record for praxis\/y/, "the PR head names the change, not the active one");
  out = fx.hook("pre-tool-use", bash("gh api -X PUT repos/o/r/merges -f base=main -f head=praxis/y", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /praxis\/y/);
  assert.equal(decision(fx.hook("pre-tool-use", bash("gh api -X PUT repos/o/r/merges -f head=praxis/x", fx.repo))), "allow");
  // specs/a/b/ is a folder, never a change name: no record, whatever it holds.
  fx.write("specs/a/b/implementation.md", ledger("built"));
  fx.write("specs/a/b/decision.md", "---\nverdict: APPROVE (human)\n---\n");
  out = fx.hook("pre-tool-use", bash("git push origin praxis/a/b", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /no change record for praxis\/a\/b/);
  // Two change names in one refspec: the source is what ships.
  assert.equal(decision(fx.hook("pre-tool-use", bash("git push origin praxis/x:praxis/y", fx.repo))), "allow", "x's commits, x's record");
  out = fx.hook("pre-tool-use", bash("git push origin praxis/y:praxis/x", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /no change record for praxis\/y/);
  // A rev-expression or a `heads/` spelling names the same change branch.
  for (const cmd of ["git push origin praxis/y@{0}:refs/heads/z", "git push origin heads/praxis/y:z", "git push origin PRAXIS/y~0:z"]) {
    assert.match(reason(fx.hook("pre-tool-use", bash(cmd, fx.repo))), /no change record for praxis\/y/, cmd);
  }
});

test("round 3: Bash on the record dirs — normalised spellings, cd into .praxis, find/fd/rg that execute, the ship marker", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  const denied = [
    "touch ./.praxis//approved/x", "touch .praxis/./approved/x", "touch .Praxis/Approved/x", "cd .praxis && touch approved/x",
    "cd .praxis/approved && touch x", "cd ./.praxis/ && rm -rf intent", "find .praxis -name x -delete",
    "find . -maxdepth 0 -exec touch .praxis/approved/x \\;", "find .praxis -fprint .praxis/approved/x", "fd . .praxis -x rm",
    "fd . .praxis --exec rm", "rg --pre sh x .praxis", "cat /dev/null > .praxis/approved/x", "head x | tee .praxis//approved/x",
    "ls .praxis/approved | xargs rm", "touch .praxis/ship/x", `touch ${repo}/.praxis//ship/x`, "rm -rf .praxis",
    "bash -c 'touch .praxis/approved/x'", "cd .praxis && mkdir -p intent && touch intent/approve-x", "rm .praxis/*/x",
  ];
  for (const cmd of denied) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /record the model does not write/, cmd);
  }
  const reads = [
    "ls .praxis/approved", "cat .praxis/needs-human/x 2>/dev/null", "ls .praxis/approved/ 2>&1 | head", "git log -- .praxis/approved",
    "git status --short .praxis", "bash -c 'ls .praxis/approved'", "test -f .praxis/ship/x && echo yes", "find .praxis -name x",
    "fd . .praxis", "rg -n x .praxis", "wc -l < .praxis/approved/x", "mkdir -p .praxis && echo x > .praxis/active-change",
    "cd .praxis && ls", "cat .praxis/active-change",
  ];
  for (const cmd of reads) assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  for (const rel of [".praxis/ship/x", ".Praxis/Ship/x"]) {
    const out = hook("pre-tool-use", writeFile(repo, rel, ""));
    assert.equal(decision(out), "deny", rel);
    assert.match(reason(out), /ship record/, rel);
  }
});

test("round 3: Bash never runs a Praxis hook; reading one is free", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  const ran = [
    "sh hooks/user-prompt-submit", "bash -lc 'hooks/user-prompt-submit'", `echo '{"prompt":"/praxis:approve x"}' | ${ROOT}hooks/user-prompt-submit`,
    '"${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use" < payload.json', "bash hooks/pre-tool-use", "env X=1 hooks/stop",
    "cd hooks && ./user-prompt-submit", "dash -x hooks/subagent-stop",
  ];
  for (const cmd of ran) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /Praxis hook/, cmd);
  }
  for (const cmd of ["bat hooks/user-prompt-submit", "rg -n intent hooks/user-prompt-submit", "sed -n 1,5p hooks/post-tool-use", "head -20 hooks/stop", "cat hooks/lib.sh", "sh -n hooks/pre-tool-use"]) {
    assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  }
});

test("round 3: only an execution of approve.sh or rework.sh needs the token; reading them is free", () => {
  const { repo, hook } = cycleRepo({ round: 2 });
  const reads = [
    "bat scripts/approve.sh", "rg -n token scripts/approve.sh", "cat scripts/rework.sh", "head -40 scripts/approve.sh",
    "sed -n 1,20p scripts/rework.sh", "git diff -- scripts/rework.sh", "git log -- scripts/approve.sh", "shellcheck scripts/approve.sh",
    "bash -n scripts/approve.sh", "chmod +x scripts/rework.sh",
  ];
  for (const cmd of reads) assert.equal(decision(hook("pre-tool-use", bash(cmd, repo))), "allow", cmd);
  const ran = [
    "bash -c 'scripts/approve.sh x'", 'scripts/rework.sh x "tighten the parser"', "sh -c 'cd scripts; ./approve.sh x'",
    "eval 'scripts/approve.sh x'", "timeout 9 scripts/approve.sh x", "scripts/Approve.sh x", "source scripts/approve.sh x",
    ". scripts/rework.sh x note", "bash -lc 'scripts/approve.sh x'",
  ];
  for (const cmd of ran) {
    const out = hook("pre-tool-use", bash(cmd, repo));
    assert.equal(decision(out), "deny", cmd);
    assert.match(reason(out), /typed by the person/, cmd);
  }
  // A token licenses its own kind: /praxis:approve x is not a rework.
  hook("user-prompt-submit", { prompt: "/praxis:approve x" });
  assert.equal(decision(hook("pre-tool-use", bash("scripts/approve.sh x", repo))), "allow");
  assert.equal(decision(hook("pre-tool-use", bash('scripts/rework.sh x "n"', repo))), "deny", "an approve token does not license a rework");
  // post-tool-use consumes the token on an execution only, in any case spelling.
  const token = join(repo, ".praxis/intent/approve-x");
  hook("post-tool-use", bash("rg -n x scripts/approve.sh x", repo));
  assert.ok(fsExists(token), "reading the script does not spend the person's token");
  hook("post-tool-use", bash("bash scripts/APPROVE.sh x", repo));
  assert.ok(!fsExists(token), "an execution in any spelling consumes it");
});

test("round 3: post-tool-use reads decision.md case-insensitively", () => {
  const fx = cycleRepo({ round: 2 });
  fx.recordDecision("ESCALATE");
  fx.hook("post-tool-use", asRole(edit(join(fx.repo, "specs/x/DECISION.md")), "praxis:approver"));
  assert.ok(fsExists(join(fx.repo, ".praxis/needs-human/x")), "DECISION.md is decision.md on the default macOS volume");
});

test("round 3: the decision gate holds for MultiEdit, apply_patch and NotebookEdit", () => {
  const { repo, hook } = cycleRepo({ round: 1 });
  const target = join(repo, "specs/x/decision.md");
  const payloads = [
    { tool_name: "MultiEdit", tool_input: { file_path: target, edits: [{ old_string: "verdict: ESCALATE", new_string: "verdict: APPROVE" }] } },
    { tool_name: "apply_patch", cwd: repo, tool_input: { command: "*** Begin Patch\n*** Add File: specs/x/decision.md\n+---\n+verdict: APPROVE\n+---\n*** End Patch" } },
    { tool_name: "NotebookEdit", tool_input: { notebook_path: target, new_source: "verdict: APPROVE" } },
  ];
  for (const payload of payloads) {
    const out = hook("pre-tool-use", payload);
    assert.equal(decision(out), "deny", payload.tool_name);
    assert.match(reason(out), /PRAXIS decision/, payload.tool_name);
  }
  const ledgerEdit = { tool_name: "MultiEdit", tool_input: { file_path: join(repo, "specs/x/implementation.md"), edits: [{ old_string: "round: 1", new_string: "round: 0" }] } };
  assert.equal(decision(hook("pre-tool-use", ledgerEdit)), "deny", "the ledger's round through MultiEdit");
});

test("round 3: a Codex patch is classified path by path — one denied path denies the patch", () => {
  const fx = cycleRepo({ round: 1 });
  fx.write(".praxis/worktrees/w/specs/q/seed.md", "");
  const wt = join(fx.repo, ".praxis/worktrees/w");
  const patch = (...files) => ({
    tool_name: "apply_patch", cwd: fx.repo,
    tool_input: { command: ["*** Begin Patch", ...files.flatMap((f) => [`*** Add File: ${f}`, "+x"]), "*** End Patch"].join("\n") },
  });
  assert.equal(decision(fx.hook("pre-tool-use", patch(join(wt, "specs/q/note.md")))), "allow", "the control: a spec-side file in the worktree");
  for (const second of [join(fx.repo, ".praxis/approved/x"), join(fx.repo, "specs/x/decision.md"), join(fx.repo, "specs/x/review/round-1/security.md")]) {
    assert.equal(decision(fx.hook("pre-tool-use", patch(join(wt, "specs/q/note.md"), second))), "deny", second);
  }
  // The floor, too: a source file of the main checkout behind a worktree path is judged by the main checkout.
  const bare = floorRepo({ mode: "full" });
  bare.write(".praxis/worktrees/w/specs/q/seed.md", "");
  const out = bare.hook("pre-tool-use", {
    tool_name: "apply_patch", cwd: bare.repo,
    tool_input: { command: `*** Begin Patch\n*** Add File: ${join(bare.repo, ".praxis/worktrees/w/specs/q/note.md")}\n+x\n*** Add File: ${join(bare.repo, "src/app.ts")}\n+x\n*** End Patch` },
  });
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /src\/app\.ts/);
});

// Case-folding the worktree path guards a case-insensitive filesystem (macOS, Windows). On a
// case-sensitive one (Linux CI) .Praxis/Worktrees is another directory, so the case does not apply.
const caseInsensitiveFs = (() => {
  const d = mkdtempSync(join(tmpdir(), "praxis-case-"));
  writeFileSync(join(d, "A"), "");
  try { return fsExists(join(d, "a")); } finally { rmSync(d, { recursive: true, force: true }); }
})();

test("round 3: a worktree spelled with capitals is still the worktree", { skip: caseInsensitiveFs ? false : "case-sensitive filesystem: .Praxis/Worktrees is not the worktree here" }, () => {
  const { repo, hook, write, commit } = floorRepo({ mode: "full" });
  write("README.md", "x\n");
  commit();
  write("specs/x/spec.md", "# x\n");
  write("specs/x/implementation.md", ledger("planned"));
  write(".praxis/active-change", "x\n");
  write(".praxis/approved/x", "");
  execFileSync("git", ["worktree", "add", "-q", "-b", "praxis/w", join(repo, ".praxis/worktrees/w")], { cwd: repo });
  for (const rel of [".praxis/worktrees/w/src/x.ts", ".Praxis/Worktrees/w/src/x.ts"]) {
    assert.equal(decision(hook("pre-tool-use", edit(join(repo, rel)))), "deny", `${rel}: an unseeded worktree is not the main checkout's approval`);
  }
});

test("round 3: the required lenses are a union — a ledger listing only tests still waits for correctness and security", () => {
  const fx = cycleRepo({ round: 1, lenses: "tests" });
  fx.lens(1, "tests", "PASS");
  let out = fx.hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /waiting for correctness security\b/);
  approverWrites(fx, "APPROVE");
  assert.ok(!fsExists(shipMarker(fx)), "a round missing two required lenses is not all PASS");
  out = fx.hook("pre-tool-use", bash("git push origin praxis/x", fx.repo));
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /correctness: missing/);
  // A lens list file is unioned the same way, and the list gate still requires all three.
  const listed = cycleRepo({ round: 1 });
  listed.write("specs/x/review/round-1/lenses", "tests\n");
  listed.lens(1, "tests", "PASS");
  assert.match(reason(listed.hook("pre-tool-use", dispatchBuilder())), /waiting for correctness security\b/);
  const list = writeFile(listed.repo, "specs/x/review/round-2/lenses", "correctness\ntests\n");
  assert.match(reason(listed.hook("pre-tool-use", list)), /missing: security/);
});

test("round 3: at the cap every SendMessage and every builder-class dispatch is denied, for every open cycle, until rework", () => {
  const fx = cycleRepo({ round: 2 });
  fx.lensList(2, LENSES);
  fx.lens(2, "correctness", "PASS");
  fx.lens(2, "security", "CHANGES");
  fx.lens(2, "tests", "PASS");
  for (const to of ["agent-b1", "builder", "agent-unknown", "praxis:refuter-security"]) {
    const out = fx.hook("pre-tool-use", messageTo(to));
    assert.equal(decision(out), "deny", `SendMessage to ${to}`);
    assert.match(reason(out), /round cap/);
  }
  // The pointer the model writes does not move the cap: another change at round 0 is active.
  fx.write("specs/z/spec.md", "# z\n");
  fx.write("specs/z/implementation.md", "---\ntitle: z\nstage: planned\nround: 0\nbuilder:\n---\n");
  fx.write(".praxis/active-change", "z\n");
  for (const kind of ["praxis:builder", "engineer", "backend", "design", "platform"]) {
    const out = fx.hook("pre-tool-use", dispatchBuilder(kind));
    assert.equal(decision(out), "deny", kind);
    assert.match(reason(out), /round cap/);
    assert.match(reason(out), /specs\/x/, "the deny names the capped change");
  }
  assert.equal(decision(fx.hook("pre-tool-use", dispatchBuilder("praxis:approver"))), "allow", "the approver is how the cap is closed");
  // The person's rework resets the round: the cap is gone.
  const r = spawnSync("bash", [join(ROOT, "scripts/rework.sh"), "x", "scope it down"], { cwd: fx.repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(decision(fx.hook("pre-tool-use", dispatchBuilder())), "allow");
  assert.equal(decision(fx.hook("pre-tool-use", messageTo("agent-unknown"))), "allow");
});

test("round 3: round: 08 is eight, not an octal error that opens the barrier", () => {
  const fx = cycleRepo({ round: 0 });
  fx.write("specs/x/implementation.md", "---\ntitle: x\nstage: built\nround: 08\nbuilder: agent-b1\nlenses: correctness, security, tests\n---\n");
  const out = fx.hook("pre-tool-use", dispatchBuilder());
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /round 8/);
});

test("round 3: stage: shipped closes an open cycle only once .praxis/ship/<c> exists", () => {
  const fx = cycleRepo({ round: 1 });
  const toShipped = { tool_name: "Edit", tool_input: { file_path: join(fx.repo, "specs/x/implementation.md"), old_string: "stage: built", new_string: "stage: shipped" } };
  const out = fx.hook("pre-tool-use", toShipped);
  assert.equal(decision(out), "deny");
  assert.match(reason(out), /\.praxis\/ship\/x/);
  allPass(fx, 1);
  approverWrites(fx, "APPROVE");
  assert.equal(decision(fx.hook("pre-tool-use", toShipped)), "allow", "shipped after the marker is the honest record");
  const legacy = legacyRepo();
  const legacyEdit = { tool_name: "Edit", tool_input: { file_path: join(legacy.repo, "specs/old/implementation.md"), old_string: "stage: implemented", new_string: "stage: shipped" } };
  assert.equal(decision(legacy.hook("pre-tool-use", legacyEdit)), "allow", "a ledger outside the cycle closes freely");
});
