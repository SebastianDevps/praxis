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

test("subagent-start resolves the dispatched agent's declared crafts", () => {
  const design = context(claude("subagent-start", { input: '{"agent_type":"praxis:design"}' }));
  assert.deepEqual(craftsIn(design).sort(), ["a11y-baseline", "anti-slop", "motion-discipline"]);

  const engineer = context(claude("subagent-start", { input: '{"agent_type":"engineer"}' }));
  assert.deepEqual(craftsIn(engineer), ["minimalism"]);
});

test("an unknown or stock agent still receives the contract", () => {
  const ctx = context(claude("subagent-start", { input: '{"agent_type":"Explore"}' }));
  assert.deepEqual(craftsIn(ctx), []);
  assert.match(ctx, /ladder/);
});

test("a host-supplied agent_type cannot traverse out of agents/", () => {
  // "../agents/design" is the discriminating payload: without the guard it
  // resolves to a real file and yields three crafts, so a vacuous test would
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
  assert.deepEqual(craftsIn(context(out)).length, 3, "an unusable regex must not drop the method");
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
