// Hook behavior. These cover the injection path added for per-turn and
// per-subagent context: two real bugs surfaced here during development (Codex
// falling through to the flat Copilot shape, which Codex drops silently, and
// grep leaking "brackets not balanced" to stderr on every spawn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, accessSync, constants } from "node:fs";
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
