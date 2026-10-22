// claude.mjs — a stand-in for `claude -p` so run.mjs and units.mjs can be proven end to end
// without spending. It prints a stream-json transcript in the shape Claude Code 2.1.x prints —
// assistant/user lines carrying `parent_tool_use_id`, `subagent_type` and `timestamp` on
// subagent messages, one `result` line with total_cost_usd, usage, modelUsage and
// subagent_stats — AND performs the file effects the transcript claims: writes the spec, edits
// source in the worktree, commits, writes the review files and the decision, pushes to the bare
// origin and calls `gh` from PATH. Every scorer therefore reads the same artifacts a live cell
// leaves behind, and `--rescore` works on a dry run the way it works on a real one.
//
// Scenarios (CYCLE_STUB_SCENARIO):
//   good        the cycle as designed: spec → stop → [the driver approves] → worktree → builder
//               → three lenses in ONE message → approver APPROVE → push + gh pr create.
//               Every scorer PASS.
//   bad         source edited before any spec, only one lens dispatched, the builder resumed
//               before the third lens file exists, a round-3 directory, no decision.md, and
//               `gh pr create` anyway. Every scorer FAIL — one bad transcript that trips each gate.
//   clarified   the spec-writer leaves a [NEEDS CLARIFICATION]; leg 1 ends on the question.
//               Every scorer SKIP; cost measured for leg 1 alone.
//
// The leg is read from the arguments: no `--resume` → leg 1, `--resume <id>` → leg 2. Hooks
// never fire here — this is not Claude Code; tests/hooks.test.mjs is what proves the hooks.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const prompt = arg("-p") ?? "";
const resume = arg("--resume");
const plugin = arg("--plugin-dir");
const scenario = process.env.CYCLE_STUB_SCENARIO ?? "good";
const project = process.cwd();
const CHANGE = "invoice-csv-export";
const sid = resume ?? randomUUID();
const leg = resume ? 2 : 1;

// ── emission ───────────────────────────────────────────────────────────────────────────────────
// Real wall-clock timestamps, a few ms apart: the scorer compares them with gh.log's clock.
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let n = 0, cost = 0, spawned = {};
const emit = (o) => { pause(3); process.stdout.write(JSON.stringify(o) + "\n"); };
const usage = () => ({ input_tokens: 2, cache_creation_input_tokens: 400, cache_read_input_tokens: 18_000, output_tokens: 150 });
const envelope = (ctx) => ({ session_id: sid, uuid: randomUUID(), timestamp: new Date().toISOString(),
  ...(ctx?.parent ? { parent_tool_use_id: ctx.parent, subagent_type: ctx.type, task_description: ctx.description } : {}) });
const assistant = (content, ctx) => { cost += 0.02; emit({ type: "assistant", message: { model: "claude-stub", id: `msg_${++n}`, type: "message", role: "assistant", content, usage: usage() }, ...envelope(ctx) }); };
const text = (t, ctx) => assistant([{ type: "text", text: t }], ctx);
const toolUses = (uses, ctx) => { const ids = uses.map(() => `toolu_${++n}`); assistant(uses.map((u, i) => ({ type: "tool_use", id: ids[i], name: u.name, input: u.input })), ctx); return ids; };
const toolUse = (name, input, ctx) => toolUses([{ name, input }], ctx)[0];
const result = (id, content, ctx, isError = false) => emit({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] }, ...envelope(ctx) });

// A tool call that also happens: the Write lands on disk, the Bash runs.
const write = (rel, body, ctx) => { const p = join(project, rel); mkdirSync(dirname(p), { recursive: true }); const id = toolUse("Write", { file_path: p, content: body }, ctx); writeFileSync(p, body); result(id, `File created successfully at: ${p}`, ctx); };
const edit = (rel, oldStr, newStr, ctx) => { const p = join(project, rel); const id = toolUse("Edit", { file_path: p, old_string: oldStr, new_string: newStr }, ctx); writeFileSync(p, readFileSync(p, "utf8").replace(oldStr, newStr)); result(id, `The file ${p} has been updated successfully.`, ctx); };
// `bash -c`, never `-lc`: a login shell re-runs the profile, which put /opt/homebrew/bin back in
// front of the stub `gh` on the first dry run and the real gh ran. run.mjs's preflight checks
// the same thing for the live `claude`.
const bash = (command, cwd, ctx) => { const id = toolUse("Bash", { command }, ctx); const r = spawnSync("bash", ["-c", command], { cwd, encoding: "utf8", env: process.env }); const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim(); result(id, out || `(exit ${r.status})`, ctx, r.status !== 0); return out; };
const agent = (type, description, promptText) => { const id = toolUse("Agent", { description, subagent_type: `praxis:${type}`, prompt: promptText }); spawned[`praxis:${type}`] = (spawned[`praxis:${type}`] ?? 0) + 1; return { parent: id, type: `praxis:${type}`, description }; };
const handback = (ctx, t) => result(ctx.parent, t);

// ── the fixture feature, as the builder would write it ─────────────────────────────────────────
const SRC = `// Invoice helpers. One module, named exports, no dependencies.
export function invoiceTotal(invoice) {
  return invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

const escapeCsvField = (value) => {
  const field = String(value);
  return /[",\\n]/.test(field) ? \`"\${field.replace(/"/g, '""')}"\` : field;
};

export function formatInvoiceCsv(invoices, { from, to }) {
  const rows = invoices
    .filter((invoice) => from <= invoice.date && invoice.date <= to)
    .map((invoice) => [invoice.id, invoice.date, invoice.customer, invoiceTotal(invoice)].map(escapeCsvField).join(","));
  return ["id,date,customer,total", ...rows].join("\\n");
}
`;
const TEST = `import test from "node:test";
import assert from "node:assert/strict";
import { invoiceTotal, formatInvoiceCsv } from "../src/invoices.js";

const invoice = (id, date, customer, amount) => ({ id, date, customer, lines: [{ quantity: 1, unitPrice: amount }] });

test("invoiceTotal sums quantity × unit price over the lines", () => {
  assert.equal(invoiceTotal({ lines: [{ quantity: 2, unitPrice: 50 }, { quantity: 1, unitPrice: 25 }] }), 125);
});

test("formatInvoiceCsv keeps both bounds inclusive and the given order", () => {
  const rows = [invoice("A", "2026-01-01", "Acme", 10), invoice("B", "2026-01-31", "Bolt", 20), invoice("C", "2026-02-01", "Cog", 30)];
  assert.equal(formatInvoiceCsv(rows, { from: "2026-01-01", to: "2026-01-31" }), "id,date,customer,total\\nA,2026-01-01,Acme,10\\nB,2026-01-31,Bolt,20");
});

test("formatInvoiceCsv escapes a customer containing a comma and a quote", () => {
  const rows = [invoice("A", "2026-01-05", 'Acme, "Inc"', 7)];
  assert.equal(formatInvoiceCsv(rows, { from: "2026-01-01", to: "2026-01-31" }), 'id,date,customer,total\\nA,2026-01-05,"Acme, ""Inc""",7');
});

test("formatInvoiceCsv with no match is the header alone", () => {
  assert.equal(formatInvoiceCsv([invoice("A", "2025-12-31", "Acme", 1)], { from: "2026-01-01", to: "2026-01-31" }), "id,date,customer,total");
});
`;
const SPEC = (ready, questions) => `---
title: ${CHANGE}
ready: ${ready}
---
# Invoice CSV Export — Spec
## Goal
\`formatInvoiceCsv(invoices, { from, to })\` in \`src/invoices.js\`: a CSV with header \`id,date,customer,total\`, rows filtered by an inclusive ISO date range, RFC 4180 escaping.
## Scope
### In
- The function, exported by name from \`src/invoices.js\`.
- Tests for both inclusive bounds and for a customer with a comma and a double quote.
### Out
- \`invoiceTotal\` stays as it is; no formatting of amounts; no file I/O.
## Acceptance
- [ ] \`npm test\` → \`# pass 4\`, \`# fail 0\`
- [ ] \`node -e "import('./src/invoices.js').then(m => console.log(m.formatInvoiceCsv([{id:'A',date:'2026-01-05',customer:'Acme, \\"Inc\\"',lines:[{quantity:1,unitPrice:7}]}], {from:'2026-01-01',to:'2026-01-31'})))"\` → \`id,date,customer,total\\nA,2026-01-05,"Acme, ""Inc""",7\`
## Approach
One escaping helper and the exported function beside \`invoiceTotal\`; string comparison on the ISO dates (AGENTS.md).
## Open questions
${questions.map((q) => `- [NEEDS CLARIFICATION] ${q}`).join("\n")}
`;
const LEDGER = (stage, round, builder) => `---
title: ${CHANGE}
stage: ${stage}
round: ${round}     # 0 = no review yet
${builder ? `builder: ${builder}\n` : ""}lenses: correctness, security, tests
owner: the person running this cell
---

# Invoice CSV Export — Implementation

## Tasks
- [ ] T01 · phase: build · state: pending · formatInvoiceCsv with tests
      files:  src/invoices.js, test/invoices.test.js
      verify: npm test

## Completed

## Blocked

## Session Notes
`;
const LENS = (lens, round, verdict) => `---
lens: ${lens}
round: ${round}
verdict: ${verdict}
---
## Findings
${verdict === "PASS" ? "- none blocking" : "- `src/invoices.js:12` — a finding — severity: important"}
## What I tried to break
- an empty invoices array → header alone
- a customer with a newline → quoted
`;
const DECISION = (verdict, round) => `---
verdict: ${verdict}
round: ${round}
---
## Checks run
- \`npm test\` → # pass 4, # fail 0
## Reason
every lens PASS; acceptance re-run in the worktree
`;

// ── the legs ───────────────────────────────────────────────────────────────────────────────────
const finish = (finalText) => emit({
  type: "result", subtype: "success", is_error: false, duration_ms: 1000 + n * 40, duration_api_ms: 900, num_turns: n, result: finalText, session_id: sid,
  total_cost_usd: +cost.toFixed(4), usage: { input_tokens: 2 * n, cache_creation_input_tokens: 400 * n, cache_read_input_tokens: 18_000 * n, output_tokens: 150 * n },
  modelUsage: { "claude-stub": { inputTokens: 2 * n, outputTokens: 150 * n, cacheReadInputTokens: 18_000 * n, cacheCreationInputTokens: 400 * n, costUSD: +cost.toFixed(4), canonicalModel: "claude-stub" } },
  permission_denials: [], subagent_stats: { spawned: Object.values(spawned).reduce((a, b) => a + b, 0), by_type: spawned }, uuid: randomUUID(),
});

emit({ type: "system", subtype: "init", cwd: project, session_id: sid, model: "claude-stub", permissionMode: "acceptEdits", plugins: plugin ? [{ name: "praxis", path: plugin }] : [], uuid: randomUUID() });

function open() {
  text(`RUN CARD — ${prompt.slice(0, 60)}\nspec:     specs/${CHANGE}/   (stage: new)\nphase:    define\napproach: delegate → spec-writer`);
  write(".praxis/active-change", `${CHANGE}\n`);
  write(`specs/${CHANGE}/implementation.md`, LEDGER("new", 0));
}
function specWriter(ready, questions) {
  const ctx = agent("spec-writer", "Write the spec", `Request: ${prompt}\nRead AGENTS.md and the repo; write specs/${CHANGE}/spec.md.`);
  const r1 = toolUse("Read", { file_path: join(project, "AGENTS.md") }, ctx); result(r1, readFileSync(join(project, "AGENTS.md"), "utf8"), ctx);
  const r2 = toolUse("Read", { file_path: join(project, "src/invoices.js") }, ctx); result(r2, readFileSync(join(project, "src/invoices.js"), "utf8"), ctx);
  write(`specs/${CHANGE}/spec.md`, SPEC(ready, questions), ctx);
  handback(ctx, `STATUS spec | ${ready ? "ready — 0 open questions" : `draft — ${questions.length} open question`} | next: ${ready ? "Needs your decision" : "orchestrator asks one"}`);
}
function builder(cwd, ctx) {
  const r = toolUse("Read", { file_path: join(cwd, `specs/${CHANGE}/spec.md`) }, ctx); result(r, "(spec)", ctx);
  const relTo = (f) => join(cwd, f).slice(project.length + 1);
  write(relTo("test/invoices.test.js"), TEST, ctx);
  write(relTo("src/invoices.js"), SRC, ctx);
  bash("npm test 2>&1 | tail -3", cwd, ctx);
  bash('git add -A && git -c user.name=builder -c user.email=builder@praxis commit -qm "feat(invoices): formatInvoiceCsv with inclusive range and RFC 4180 escaping" && git log --oneline -1', cwd, ctx);
}

if (leg === 1) {
  if (scenario === "bad") {
    open();
    // The builder first, in the main checkout, with no spec anywhere.
    const b = agent("builder", "Build it", `Implement: ${prompt}`);
    builder(project, b);
    handback(b, "STATUS build | green | next: handback");
    specWriter(true, []);
    text("RUN CARD — Needs your decision");
    finish("RUN CARD — Needs your decision (spec written after the build)");
  } else if (scenario === "clarified") {
    open();
    specWriter(false, ["Should `total` be printed with two decimals (`125.00`) or as a plain number (`125`)?"]);
    const q = "One question before the spec is ready: should `total` be printed with two decimals (`125.00`) or as a plain number (`125`)?";
    text(q);
    finish(q);
  } else {
    open();
    specWriter(true, []);
    edit(`specs/${CHANGE}/implementation.md`, "stage: new", "stage: designed");
    text(`RUN CARD — spec ready\nspec:     specs/${CHANGE}/   (stage: designed)\nphase:    Needs your decision`);
    finish(`RUN CARD — Needs your decision: approve specs/${CHANGE}/spec.md (/praxis:approve ${CHANGE})`);
  }
} else if (scenario === "bad") {
  const b = "agent-b1";
  edit(`specs/${CHANGE}/implementation.md`, "round: 0", "round: 1");
  edit(`specs/${CHANGE}/implementation.md`, "lenses:", `builder: ${b}\nlenses:`);
  write(`specs/${CHANGE}/review/round-1/lenses`, "correctness\nsecurity\ntests\n");
  const l1 = agent("refuter-correctness", "Correctness lens", `Round 1. Write specs/${CHANGE}/review/round-1/correctness.md`);
  write(`specs/${CHANGE}/review/round-1/correctness.md`, LENS("correctness", 1, "PASS"), l1);
  handback(l1, "verdict: PASS");
  // The main thread writes a lens file, resumes the builder with one lens still missing, then
  // writes the missing file, opens a round-3 directory and ships without any decision.
  write(`specs/${CHANGE}/review/round-1/security.md`, LENS("security", 1, "CHANGES"));
  const m = toolUse("SendMessage", { to: b, message: `round 1 CHANGES: specs/${CHANGE}/review/round-1/security.md` });
  result(m, "delivered");
  edit("src/invoices.js", "const escapeCsvField", "const escapeCsvField /* round 1 */", { parent: m, type: "praxis:builder", description: "Build it" });
  write(`specs/${CHANGE}/review/round-1/tests.md`, LENS("tests", 1, "CHANGES"));
  write(`specs/${CHANGE}/review/round-3/lenses`, "correctness\nsecurity\ntests\n");
  bash(`gh pr create --head praxis/${CHANGE} --fill`, project);
  finish("RUN CARD — ship (PR opened)");
} else {
  const wt = bash(`bash ${JSON.stringify(join(plugin ?? "", "scripts", "worktree.sh"))} ${CHANGE}`, project).split("\n").at(-1);
  edit(`specs/${CHANGE}/implementation.md`, "stage: designed", "stage: planned");
  const b = agent("builder", "Build the spec", `Worktree: ${wt}\nSpec: ${wt}/specs/${CHANGE}/spec.md\nRead the spec and nothing else.`);
  builder(wt, b);
  handback(b, "STATUS build | green — 2 slices, 1 commit, acceptance 2/2 PASS | next: handback");
  edit(`specs/${CHANGE}/implementation.md`, "stage: planned", "stage: built");
  edit(`specs/${CHANGE}/implementation.md`, "round: 0", "round: 1");
  edit(`specs/${CHANGE}/implementation.md`, "lenses:", `builder: ${b.parent}\nlenses:`);
  write(`specs/${CHANGE}/review/round-1/lenses`, "correctness\nsecurity\ntests\n");
  const lensPrompt = (lens) => `Round 1. Spec: specs/${CHANGE}/spec.md. Worktree: ${wt}. Write specs/${CHANGE}/review/round-1/${lens}.md`;
  const ids = toolUses(["correctness", "security", "tests"].map((lens) => ({ name: "Agent", input: { description: `${lens} lens`, subagent_type: `praxis:refuter-${lens}`, prompt: lensPrompt(lens) } })));
  const lenses = ["correctness", "security", "tests"].map((lens, i) => { spawned[`praxis:refuter-${lens}`] = 1; return { parent: ids[i], type: `praxis:refuter-${lens}`, description: `${lens} lens` }; });
  for (const [i, lens] of ["correctness", "security", "tests"].entries()) {
    bash("git diff main...HEAD --stat", wt, lenses[i]);
    write(`specs/${CHANGE}/review/round-1/${lens}.md`, LENS(lens, 1, "PASS"), lenses[i]);
    handback(lenses[i], "verdict: PASS");
  }
  const a = agent("approver", "Approve or escalate", `Spec: specs/${CHANGE}/spec.md. Worktree: ${wt}. Reviews: specs/${CHANGE}/review/round-*/. Write specs/${CHANGE}/decision.md`);
  bash("npm test 2>&1 | tail -3", wt, a);
  write(`specs/${CHANGE}/decision.md`, DECISION("APPROVE", 1), a);
  handback(a, "STATUS approve | APPROVE — 2 checks run, round 1 all PASS | next: ship gate");
  const url = bash(`cd ${JSON.stringify(wt)} && git push -u origin praxis/${CHANGE} 2>&1 && gh pr create --head praxis/${CHANGE} --fill`, project).split("\n").at(-1);
  edit(`specs/${CHANGE}/implementation.md`, "stage: built", `stage: shipped\npr: ${url}`);
  text(`RUN CARD — ship\nPR ${url} · 1 round · 0 questions · 5 subagents`);
  finish(`RUN CARD — ship: PR ${url} open · 1 round · 5 subagents`);
}
