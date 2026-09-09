// `/praxis:init` writes into the USER's repository — the one place a plugin must never be
// careless. Two defects this guards: a scaffold that overwrites a file the user already has
// (their AGENTS.md, their .claude/rules), and a scaffold that is not idempotent, so a second run
// "creates" again and a team cannot run it safely on an initialized repo. Every assertion below
// runs the real script in a temp dir; nothing is mocked. Mutation-tested: drop the
// exists-check in copy_if_missing and the custom-AGENTS.md test fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCRIPT = join(ROOT, "scripts", "init.sh");
const CLEAN = { PATH: process.env.PATH, HOME: process.env.HOME };

function init(cwd) {
  return execFileSync("bash", [SCRIPT], { cwd, env: CLEAN, encoding: "utf8", timeout: 10_000 });
}

const freshProject = () => mkdtempSync(join(tmpdir(), "praxis-init-"));
const createLines = (out) => out.split("\n").filter((l) => l.startsWith("create "));
const isSymlink = (p) => lstatSync(p).isSymbolicLink();

const SCAFFOLD = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "agents/README.md",
  "agents/rules/_sections.md",
  "agents/rules/_template.md",
  "agents/knowledge-base.md",
  "agents/commands.md",
  "specs/_templates/design.md",
  "specs/_templates/implementation.md",
  "specs/_templates/decisions.md",
  "specs/_templates/future-work.md",
  "specs/_templates/AGENTS.md",
  "specs/_templates/CLAUDE.md",
  "specs/_templates/docs/README.md",
  ".claude/rules",
];

test("first run creates the whole scaffold in an empty directory", () => {
  const project = freshProject();
  const out = init(project);
  const missing = SCAFFOLD.filter((p) => !existsSync(join(project, p)));
  assert.deepEqual(missing, [], `scaffold paths missing after init: ${missing}`);
  // The idempotence test below asserts "no create lines"; that is vacuous unless a first run
  // actually emits them, so pin it here.
  assert.ok(createLines(out).length >= SCAFFOLD.length - 1, `first run emitted too few create lines:\n${out}`);
  assert.match(out, /^create AGENTS\.md$/m);
  assert.match(out, /^create CONTEXT\.md$/m);
});

test("the scaffold carries the glossary and the capabilities index, not just the file names", () => {
  // SCAFFOLD pins that CONTEXT.md exists; an empty file would pass it. Pin the two things the
  // model is told to fill from the repo: the Avoid lists and the capabilities table.
  const project = freshProject();
  init(project);
  const context = readFileSync(join(project, "CONTEXT.md"), "utf8");
  assert.match(context, /^Avoid: /m, "CONTEXT.md has no Avoid list");
  assert.doesNotMatch(context, /^\s*(import|export|function|class) /m, "CONTEXT.md carries code");
  const agents = readFileSync(join(project, "AGENTS.md"), "utf8");
  assert.match(agents, /^## Capabilities$/m, "AGENTS.md has no Capabilities section");
  assert.match(agents, /Before writing new glue/, "AGENTS.md lost the check-first rule");
  assert.match(agents, /proceed silently/, "AGENTS.md lost the missing-doc rule");
  assert.match(agents, /Contradicts ADR-NNN/, "AGENTS.md lost the ADR-conflict rule");
});

test("CLAUDE.md resolves to AGENTS.md and .claude/rules to agents/rules", () => {
  const project = freshProject();
  init(project);
  assert.ok(isSymlink(join(project, "CLAUDE.md")), "CLAUDE.md is not a symlink");
  assert.equal(readlinkSync(join(project, "CLAUDE.md")), "AGENTS.md");
  assert.equal(realpathSync(join(project, ".claude/rules")), realpathSync(join(project, "agents/rules")));
  // The template's own CLAUDE.md is a symlink in the plugin; it must survive the copy as a
  // symlink, or as a copy with identical content where symlinks are unavailable.
  const tpl = join(project, "specs/_templates");
  if (isSymlink(join(tpl, "CLAUDE.md"))) {
    assert.equal(readlinkSync(join(tpl, "CLAUDE.md")), "AGENTS.md");
  } else {
    assert.equal(readFileSync(join(tpl, "CLAUDE.md"), "utf8"), readFileSync(join(tpl, "AGENTS.md"), "utf8"));
  }
});

test("second run is a no-op: only keep lines, nothing changes", () => {
  const project = freshProject();
  init(project);
  const before = SCAFFOLD.map((p) => [p, lstatSync(join(project, p)).mtimeMs]);
  const out = init(project);
  assert.deepEqual(createLines(out), [], `second run still creates:\n${out}`);
  assert.ok(out.split("\n").filter(Boolean).every((l) => l.startsWith("keep ")), `unexpected line:\n${out}`);
  for (const [p, mtime] of before) {
    assert.equal(lstatSync(join(project, p)).mtimeMs, mtime, `${p} was rewritten on the second run`);
  }
});

test("a pre-existing AGENTS.md with custom content is untouched", () => {
  const project = freshProject();
  const custom = "# Mine\n\nHand-written. Do not replace.\n";
  writeFileSync(join(project, "AGENTS.md"), custom);
  const out = init(project);
  assert.equal(readFileSync(join(project, "AGENTS.md"), "utf8"), custom, "init overwrote the user's AGENTS.md");
  assert.match(out, /^keep AGENTS\.md$/m);
  assert.doesNotMatch(out, /^create AGENTS\.md$/m);
  // The siblings are still created — "keep" is per entry, not all-or-nothing.
  assert.ok(existsSync(join(project, "agents/commands.md")));
});

test("a pre-existing CONTEXT.md with custom content is untouched", () => {
  // The glossary is the file a team writes by hand over months; it is the worst one to
  // overwrite. Mutation-tested: make the CONTEXT.md copy unconditional and this fails.
  const project = freshProject();
  const custom = "# Ours\n\n**Order**:\nA confirmed request to buy.\nAvoid: purchase\n";
  writeFileSync(join(project, "CONTEXT.md"), custom);
  const out = init(project);
  assert.equal(readFileSync(join(project, "CONTEXT.md"), "utf8"), custom, "init overwrote the user's CONTEXT.md");
  assert.match(out, /^keep CONTEXT\.md$/m);
  assert.doesNotMatch(out, /^create CONTEXT\.md$/m);
  assert.ok(existsSync(join(project, "AGENTS.md")), "siblings were not created");
});

test("a pre-existing real .claude/rules directory is kept, not replaced by a symlink", () => {
  const project = freshProject();
  mkdirSync(join(project, ".claude/rules"), { recursive: true });
  writeFileSync(join(project, ".claude/rules/mine.md"), "# mine\n");
  const out = init(project);
  assert.ok(!isSymlink(join(project, ".claude/rules")), ".claude/rules was replaced by a symlink");
  assert.equal(readFileSync(join(project, ".claude/rules/mine.md"), "utf8"), "# mine\n");
  assert.match(out, /^keep \.claude\/rules/m);
});
