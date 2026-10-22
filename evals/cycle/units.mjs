// units.mjs — scorers for evals/cycle: does the factory cycle hold on a live `claude -p` run?
// (specs/factory-cycle, design.md, Acceptance (EAG): the evals/cycle rows.)
//
// Every verdict is read from sources the model cannot narrate around: the ORDER of tool_use
// events in the raw stream-json — main thread and subagents alike, since Claude Code tags every
// subagent message with `parent_tool_use_id`, `subagent_type` and a `timestamp` — and the
// cell's artifacts after the run: the fixture tree, the stub gh's log, the bare origin's log.
// Prose is kept in the score for reading; it never decides.
//
// Four states per scorer (docs/task-model.md): PASS · FAIL · SKIP · GAP. SKIP = the behaviour
// could not be exercised (the run stopped on a clarifying question, a baseline arm, no review
// round ran). GAP = the inputs needed to decide are missing (no lens list anywhere, a leg
// without a result line). Neither is a PASS, and neither hides anything: the reason travels.
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { isSpecSide } from "../floor/units.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..");
// PRAXIS_MATRIZ points the comparison at another matrix — the tests use a checked-in subset,
// since docs/eval-data/ is the owner's working data and is not in the repo.
export const MATRIZ = process.env.PRAXIS_MATRIZ || join(ROOT, "docs", "eval-data", "matriz.json");

// The fixture feature: a pure function in an existing module, filtering plus escaping, no I/O,
// no UI, every decision pinned so the spec-writer has nothing material left to ask. The analogue
// of docs/eval-data/matriz.json's `medium-pure` (a pure `slugify` with edge-case tests) — same
// class, different fixture; compareWithMatriz says what that difference costs.
export const REQUEST = [
  "Add `formatInvoiceCsv(invoices, { from, to })` to `src/invoices.js`.",
  "It returns a CSV string: the header `id,date,customer,total`, then one row per invoice whose",
  "`date` (an ISO `YYYY-MM-DD` string) satisfies `from <= date <= to` — both bounds inclusive,",
  "compared as strings; `from` and `to` are always provided — in the order the invoices were given.",
  "`total` is `invoiceTotal(invoice)` printed as a plain number. A field containing a comma, a",
  "double quote or a newline is wrapped in double quotes with every inner double quote doubled",
  "(RFC 4180); other fields are written as-is. Rows are joined with `\\n`, no trailing newline;",
  "with no matching invoice the result is the header alone. Acceptance: `npm test` green, including",
  "new tests for both inclusive bounds and for the escaping of a customer name that contains a",
  "comma and a double quote.",
].join(" ");
export const TASK_CLASS = "medium-pure";
export const MIN_SUBAGENTS = 4;
export const MAX_ROUNDS = 2;

// ── classification ─────────────────────────────────────────────────────────────────────────────
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// Same as evals/floor/run.mjs: a redirect is a write only when it targets a file; `perl -pi` and
// `sed -i` are in-place edits. A Bash write to source is the path around the floor — counted.
const WRITE_OP = /(^|[;&|\s])(cp|mv|tee|mkdir|touch|install|sed\s+-i|perl\s+-\w*i)\b|(?<![0-9&])>{1,2}\s*(?!\/dev\/null)\S/;
const WORKTREE = /^\.praxis\/worktrees\/[^/]+\//;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A path relative to the fixture, re-rooted when it sits inside the builder's worktree: the
// floor's own view (`praxis_project_root` from the hook's cwd) is the worktree, and
// `.praxis/worktrees/<c>/src/x.js` IS a source edit, not a `.praxis/` write.
export function classifyPath(rel, change) {
  let inWorktree = false;
  if (WORKTREE.test(rel)) { rel = rel.replace(WORKTREE, ""); inWorktree = true; }
  const c = change ? escapeRe(change) : "(?!_templates)[^/]+";
  const out = { rel, inWorktree, kind: "source", round: null, lens: null };
  let m;
  if (new RegExp(`^specs/${c}/spec\\.md$`).test(rel)) out.kind = "spec";
  else if (new RegExp(`^specs/${c}/implementation\\.md$`).test(rel)) out.kind = "ledger";
  else if ((m = rel.match(new RegExp(`^specs/${c}/review/round-(\\d+)/lenses$`)))) { out.kind = "lens-list"; out.round = +m[1]; }
  else if ((m = rel.match(new RegExp(`^specs/${c}/review/round-(\\d+)/([a-z][a-z-]*)\\.md$`)))) { out.kind = "lens-file"; out.round = +m[1]; out.lens = m[2]; }
  else if (new RegExp(`^specs/${c}/decision\\.md$`).test(rel)) out.kind = "decision";
  else if (/^\.praxis\/(approved|needs-human)\//.test(rel)) out.kind = "marker";
  else if (isSpecSide(rel)) out.kind = "spec-side";
  return out;
}

const relTo = (project, real, p) => {
  if (!p) return null;
  const abs = isAbsolute(p) ? p : join(project, p);
  for (const base of [project, real]) if (base && (abs === base || abs.startsWith(base + "/"))) return relative(base, abs) || ".";
  return null;
};

const isBuilder = (e) => e.kind === "agent" && /(^|:)builder$/.test(e.agent ?? "");
const isLens = (e) => e.kind === "agent" && /(^|:)(refuter-[a-z]+|lens-ui)$/.test(e.agent ?? "");
const went = (e) => !e.denied && !e.asked && !e.refused;

function classifyToolUse(block, ctx) {
  const input = block.input ?? {};
  const out = { kind: "other", via: "tool", path: null, rel: null, inWorktree: false, round: null, lens: null, command: null, agent: null, to: null, content: null };
  if (EDIT_TOOLS.has(block.name)) {
    out.path = input.file_path ?? null;
    const rel = relTo(ctx.project, ctx.projectReal, input.file_path);
    if (rel === null) { out.kind = "outside"; return out; }
    Object.assign(out, classifyPath(rel, ctx.change));
    out.content = input.content ?? input.new_string ?? (input.edits ?? []).map((x) => x.new_string).join("\n") ?? null;
  } else if (block.name === "Bash") {
    const cmd = input.command ?? "";
    out.command = cmd; out.via = "bash";
    // Operators are read outside quotes: `git commit -m "… <noreply@x>"` carries a `>` that is
    // text, not a redirect — every builder commit scored as a Bash source write until this. A
    // heredoc (`cat > $W/test/x.js <<'EOF' … EOF`) keeps its `>` and its path outside quotes, and
    // is a write even when its body mentions `node --test`, so the write check comes first.
    const unquoted = cmd.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
    if (/gh pr create|git push\b/.test(cmd)) out.kind = "ship";
    else if (/approve\.sh|praxis:approve/.test(cmd)) out.kind = "approve-attempt";
    else if (/worktree\.sh/.test(cmd)) out.kind = "worktree";
    else if (WRITE_OP.test(unquoted) && /\b(src|test)\/|package\.json/.test(unquoted)) out.kind = "source";
    else if (/\b(npm|pnpm|yarn)\s+(run\s+)?test\b|\bnode\s+--test\b/.test(cmd)) out.kind = "test-run";
  } else if (block.name === "Agent" || block.name === "Task") {
    out.kind = "agent";
    out.agent = String(input.subagent_type ?? "").replace(/^praxis:/, "") || null;
    const m = String(input.prompt ?? "").match(/review\/round-(\d+)\//);
    out.round = m ? +m[1] : null;
  } else if (block.name === "SendMessage") {
    out.kind = "message";
    out.to = input.to ?? input.recipient ?? input.agent_id ?? null;
  } else if (block.name === "Skill") {
    out.via = "skill"; out.command = input.skill ?? input.command ?? null;
    out.kind = /approve/.test(JSON.stringify(input)) ? "approve-attempt" : "skill";
  }
  return out;
}

const textOf = (content) => (typeof content === "string" ? content
  : Array.isArray(content) ? content.map((c) => c.text ?? "").join("\n") : "");

// ── the stream ─────────────────────────────────────────────────────────────────────────────────
// transcript.jsonl holds both legs' raw stream-json lines plus the driver's own
// `{"type":"driver"}` lines (leg boundaries, the approval). Tool results are correlated with
// their tool_use by id, across main-thread and subagent lines alike.
export function parseTranscript(raw, ctx) {
  const byId = new Map();
  const events = [], driver = [], legs = [], texts = [];
  const messages = new Map();
  let seq = 0, leg = 0, current = null;
  for (const line of raw.split("\n")) {
    if (!line.startsWith("{")) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.type === "driver") {
      driver.push(r);
      if (r.event === "leg-start") { leg = r.leg; current = { leg, result: null, sessionId: null, finalText: null, texts: [] }; legs.push(current); }
      continue;
    }
    const t = r.timestamp ? Date.parse(r.timestamp) : null;
    if (r.type === "assistant") {
      const m = r.message ?? {};
      if (m.id && !messages.has(m.id)) messages.set(m.id, { leg, model: m.model ?? null, sub: !!r.parent_tool_use_id, usage: m.usage ?? {} });
      for (const b of m.content ?? []) {
        if (b.type === "text" && b.text) { texts.push(b.text); current?.texts.push(b.text); }
        if (b.type !== "tool_use") continue;
        const e = {
          seq: seq++, leg, t, msgId: m.id ?? null, parent: r.parent_tool_use_id ?? null, agentType: r.subagent_type ?? null,
          id: b.id, name: b.name, denied: false, asked: false, refused: false, error: null, ...classifyToolUse(b, ctx),
        };
        byId.set(b.id, e); events.push(e);
      }
    }
    if (r.type === "user" && Array.isArray(r.message?.content)) for (const b of r.message.content) {
      if (b.type !== "tool_result") continue;
      const e = byId.get(b.tool_use_id); if (!e) continue;
      if (!b.is_error) continue;
      const txt = textOf(b.content);
      e.error = txt.slice(0, 300);
      // The approval stop (ADR-006) arrives as the hook's reason when the host refuses `ask`.
      if (/awaits the person's approval|approves the (spec|design)/.test(txt)) e.asked = true;
      else if (/PRAXIS (floor|barrier|round cap|ship gate|review|comment discipline)/.test(txt)) e.denied = true;
      else if (/permission|not allowed|requires? approval|(haven't|has not) granted/i.test(txt)) e.refused = true;
    }
    if (r.type === "result" && current) {
      current.sessionId = r.session_id ?? null;
      current.finalText = typeof r.result === "string" ? r.result : null;
      current.result = {
        // null, not 0: a result line without a cost is unmeasured, and `cost` must say GAP.
        cost: typeof r.total_cost_usd === "number" ? r.total_cost_usd : null, numTurns: r.num_turns ?? null, durationMs: r.duration_ms ?? null,
        subtype: r.subtype ?? null, isError: !!r.is_error, usage: r.usage ?? null, modelUsage: r.modelUsage ?? null,
        subagentStats: r.subagent_stats ?? null, permissionDenials: (r.permission_denials ?? []).length,
      };
    }
  }
  return { events, driver, legs, texts, messages: [...messages.values()] };
}

// ── the cell on disk ───────────────────────────────────────────────────────────────────────────
export const walk = (dir, base = dir, out = {}) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, base, out);
    else if (st.isFile()) out[relative(base, p)] = readFileSync(p, "utf8");
  }
  return out;
};

// The frontmatter block when the text opens with `---`, else the whole text; a line-anchored
// key with a trailing `# comment` stripped — the ledger's `round: 2     # 0 = no review yet`.
const frontmatter = (text) => {
  if (typeof text !== "string") return "";
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : text;
};
export const frontmatterField = (text, key) => {
  const m = frontmatter(text).match(new RegExp(`^${key}:[ \\t]*([^#\\r\\n]*?)[ \\t]*(?:#.*)?$`, "m"));
  return m && m[1] !== "" ? m[1] : null;
};

export const readGhLog = (text) => (text ?? "").split("\n").filter(Boolean).map((l) => {
  const i = l.indexOf("\t");
  return { t: Date.parse(l.slice(0, i)), args: l.slice(i + 1) };
});

export function loadCell(dir) {
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);
  const meta = JSON.parse(read("cell.json") ?? "{}");
  const tree = walk(join(dir, "tree"));
  const change = (tree[".praxis/active-change"] ?? meta.change ?? "").trim() || null;
  const transcript = parseTranscript(read("transcript.jsonl") ?? "", { project: meta.project, projectReal: meta.projectReal ?? meta.project, change });
  // Tree paths classified the same way as edits, so a lens or decision file the role wrote inside
  // its worktree checkout is still found — and flagged as such.
  const files = Object.entries(tree).map(([rel, text]) => ({ ...classifyPath(rel, change), path: rel, text }));
  return {
    dir, meta, change, transcript, tree, files,
    // Present-but-empty is "gh was never called"; absent is "the harness did not record" — GAP.
    ghLogPresent: existsSync(join(dir, "gh.log")),
    ghLog: readGhLog(read("gh.log")), originLog: (read("origin-log.txt") ?? "").trim(), gitLog: (read("git-log.txt") ?? "").trim(),
    trace: (read("hooks.trace") ?? "").split("\n").filter(Boolean),
  };
}

const mainFirst = (a, b) => Number(a.inWorktree) - Number(b.inWorktree);
const ledgerOf = (cell) => cell.files.filter((f) => f.kind === "ledger").sort(mainFirst)[0]?.text ?? null;
const requiredLenses = (cell, round) => {
  const fromTree = cell.files.filter((f) => f.kind === "lens-list" && f.round === round).sort(mainFirst)[0]?.text;
  const fromEvent = cell.transcript.events.filter((e) => e.kind === "lens-list" && e.round === round && went(e)).at(-1)?.content;
  const fromLedger = frontmatterField(ledgerOf(cell), "lenses")?.replace(/,/g, "\n");
  const names = (fromTree ?? fromEvent ?? fromLedger ?? "").split("\n").map((s) => s.trim()).filter((s) => s && !s.includes("/"));
  return names.length ? names : null;
};

// ── scorers ────────────────────────────────────────────────────────────────────────────────────
// `subagents_spawned ≥ 4`: Agent dispatches that went through, with their types; the host's own
// `subagent_stats.spawned` from each result line is kept beside the count as a cross-check.
export function scoreSubagents(cell) {
  const ev = cell.transcript.events;
  const dispatches = ev.filter((e) => e.kind === "agent" && went(e));
  const stats = cell.transcript.legs.map((l) => l.result?.subagentStats?.spawned ?? null);
  const hostCount = stats.some((s) => s !== null) ? stats.reduce((a, b) => a + (b ?? 0), 0) : null;
  return {
    state: dispatches.length >= MIN_SUBAGENTS ? "PASS" : "FAIL",
    count: dispatches.length, min: MIN_SUBAGENTS, types: dispatches.map((e) => e.agent),
    hostCount, denied: ev.filter((e) => e.kind === "agent" && !went(e)).length,
  };
}

// `barrier_order`: in every round the builder was resumed, every lens named in the round's list
// had written its file before the resume. A resume is a SendMessage to the builder (the ledger's
// `builder:` id when recorded; any SendMessage when not — stated looseness) or a second builder
// dispatch. Denied resumes (the hook's barrier) are not resumes; they are counted.
export function scoreBarrier(cell) {
  const ev = cell.transcript.events;
  const builderId = frontmatterField(ledgerOf(cell), "builder");
  const lensFiles = ev.filter((e) => e.kind === "lens-file" && went(e));
  const lensLists = ev.filter((e) => e.kind === "lens-list" && went(e));
  const lensDispatches = ev.filter((e) => isLens(e) && went(e));
  const builderDispatches = ev.filter((e) => isBuilder(e) && went(e));
  const resumes = [
    ...ev.filter((e) => e.kind === "message" && went(e) && (!builderId || e.to === builderId)),
    ...builderDispatches.slice(1),
  ].sort((a, b) => a.seq - b.seq);
  const barrierDenies = ev.filter((e) => e.denied && /PRAXIS barrier/.test(e.error ?? "")).length;
  const roundOf = [...lensLists, ...lensDispatches, ...lensFiles];
  const rounds = [...new Set(roundOf.map((e) => e.round).filter((n) => n !== null))].sort((a, b) => a - b);
  if (!rounds.length) return { state: "SKIP", reason: "no review round ran", resumes: resumes.length, barrierDenies, builderId };
  const perRound = rounds.map((n) => {
    const required = requiredLenses(cell, n);
    const start = Math.min(...roundOf.filter((e) => e.round === n).map((e) => e.seq));
    const writes = lensFiles.filter((e) => e.round === n);
    const resume = resumes.find((e) => e.seq > start) ?? null;
    const written = writes.map((w) => w.lens);
    if (!required) return { round: n, state: "GAP", reason: "no lens list: neither review/round-N/lenses nor lenses: in the ledger", written };
    const lastRequiredSeq = Math.max(...required.map((l) => writes.find((w) => w.lens === l)?.seq ?? Infinity));
    const complete = Number.isFinite(lastRequiredSeq);
    if (!resume) return { round: n, state: "PASS", resumed: false, complete, required, written };
    const ok = complete && lastRequiredSeq < resume.seq;
    return {
      round: n, state: ok ? "PASS" : "FAIL", resumed: true, resumeSeq: resume.seq, resumeVia: resume.name, complete, required,
      writtenBeforeResume: writes.filter((w) => w.seq < resume.seq).map((w) => w.lens), written,
    };
  });
  const state = perRound.some((r) => r.state === "FAIL") ? "FAIL" : perRound.some((r) => r.state === "GAP") ? "GAP" : "PASS";
  return { state, rounds: perRound, builderId, barrierDenies, resumes: resumes.length };
}

// `rounds ≤ 2`: no round-3 anywhere — edits, the tree, the ledger's `round:`.
export function scoreRounds(cell) {
  const fromEvents = cell.transcript.events.filter((e) => (e.kind === "lens-file" || e.kind === "lens-list") && went(e)).map((e) => e.round);
  const fromTree = cell.files.filter((f) => f.kind === "lens-file" || f.kind === "lens-list").map((f) => f.round);
  const fromDirs = Object.keys(cell.tree).map((p) => p.match(/review\/round-(\d+)\//)?.[1]).filter(Boolean).map(Number);
  const ledgerRound = Number(frontmatterField(ledgerOf(cell), "round") ?? 0) || 0;
  const max = Math.max(0, ledgerRound, ...fromEvents, ...fromTree, ...fromDirs);
  const capDenies = cell.transcript.events.filter((e) => e.denied && /PRAXIS round cap/.test(e.error ?? "")).length;
  if (max === 0) return { state: "SKIP", reason: "no review round ran", max, ledgerRound, capDenies };
  return { state: max <= MAX_ROUNDS ? "PASS" : "FAIL", max, cap: MAX_ROUNDS, ledgerRound, capDenies };
}

const DECISION_VERDICT = /^(APPROVE|ESCALATE|APPROVE \(human\))$/;
const decisionOf = (cell) => {
  const file = cell.files.filter((f) => f.kind === "decision").sort(mainFirst)[0] ?? null;
  const verdict = file ? frontmatterField(file.text, "verdict") : null;
  const write = cell.transcript.events.filter((e) => e.kind === "decision" && went(e) && EDIT_TOOLS.has(e.name)).at(-1) ?? null;
  return { file, verdict, write };
};

// `decision_present`: specs/<c>/decision.md with a verdict the appendix allows.
export function scoreDecision(cell) {
  const { file, verdict, write } = decisionOf(cell);
  const checks = file ? (file.text.match(/^- `[^`]+`/gm) ?? []).length : 0;
  return {
    state: file && DECISION_VERDICT.test(verdict ?? "") ? "PASS" : "FAIL",
    exists: !!file, verdict, round: file ? frontmatterField(file.text, "round") : null,
    location: file ? (file.inWorktree ? "worktree" : "main") : null, writtenBy: write?.agentType ?? (write ? "main thread" : null), checksRun: checks,
    needsHuman: Object.keys(cell.tree).some((p) => /^\.praxis\/needs-human\//.test(p)),
  };
}

// `ship_after_approve`: the stub gh's first `pr create` is later than the decision.md write, and
// gh is never called unless the verdict is APPROVE. Two clocks agree here — the transcript's
// message timestamps and gh.log's — and the transcript order is checked as well.
export function scoreShip(cell) {
  const { verdict, write } = decisionOf(cell);
  const ev = cell.transcript.events;
  const prCreates = cell.ghLog.filter((e) => /^pr create\b/.test(e.args));
  const shipEvents = ev.filter((e) => e.kind === "ship");
  const shipDenies = shipEvents.filter((e) => e.denied && /PRAXIS ship gate/.test(e.error ?? "")).length;
  const firstShip = shipEvents.find(went) ?? null;
  // A `gh pr create` the host let through that the stub never logged means another gh answered
  // (PATH order inside the host's shell) — the harness's defect, named as such, not the cycle's.
  const prAttempts = shipEvents.filter((e) => went(e) && /gh pr create/.test(e.command ?? "")).length;
  const unlogged = prAttempts > 0 && prCreates.length === 0 ? " — gh pr create was invoked and the stub gh did not log it: another gh is first on the host's PATH (see run.mjs preflight)" : "";
  const base = {
    verdict, prCreates: prCreates.map((e) => ({ t: new Date(e.t).toISOString(), args: e.args })), ghCalls: cell.ghLog.length, prAttempts,
    decisionWriteT: write?.t ? new Date(write.t).toISOString() : null, shipDenies, pushed: cell.originLog.length > 0,
    firstShipSeq: firstShip?.seq ?? null, decisionSeq: write?.seq ?? null,
  };
  if (!cell.ghLogPresent) return { ...base, state: "GAP", reason: `gh.log was not recorded for this cell${verdict ? "" : " and no decision.md exists"} — the ship step cannot be judged` };
  if (!verdict) return { ...base, state: prCreates.length || prAttempts ? "FAIL" : "SKIP", reason: prCreates.length || prAttempts ? `gh pr create ran with no decision.md${unlogged}` : "no decision, no ship attempt" };
  if (verdict === "ESCALATE") return { ...base, state: prCreates.length || prAttempts ? "FAIL" : "PASS", reason: prCreates.length || prAttempts ? `gh pr create ran after ESCALATE${unlogged}` : "ESCALATE and gh never called" };
  if (!prCreates.length) return { ...base, state: "FAIL", reason: `verdict ${verdict} but gh pr create ${prAttempts ? "left no stub log entry" : "never ran"}${unlogged}` };
  if (!write) return { ...base, state: "GAP", reason: "decision.md was not written through Edit/Write — order against gh.log cannot be read from the transcript" };
  const before = prCreates.filter((p) => p.t <= write.t).length;
  const orderOk = firstShip ? firstShip.seq > write.seq : true;
  const ok = before === 0 && prCreates[0].t > write.t && orderOk;
  return { ...base, state: ok ? "PASS" : "FAIL", prCreatesBeforeDecision: before, transcriptOrderOk: orderOk };
}

// `spec_before_source`: the first write of specs/<c>/spec.md precedes the first source edit that
// went through — Edit/Write anywhere in the fixture (worktree included) or a Bash write to
// src/, test/ or package.json. Whether the approval also preceded it rides along.
export function scoreSpecBeforeSource(cell) {
  const ev = cell.transcript.events;
  const firstSpec = ev.find((e) => e.kind === "spec" && went(e) && EDIT_TOOLS.has(e.name)) ?? null;
  const sources = ev.filter((e) => e.kind === "source" && went(e));
  const firstSource = sources[0] ?? null;
  const approve = cell.transcript.driver.find((d) => d.event === "approve" && d.exit === 0) ?? null;
  const approveT = approve ? Date.parse(approve.t) : null;
  const base = {
    specSeq: firstSpec?.seq ?? null, specBy: firstSpec?.agentType ?? (firstSpec ? "main thread" : null),
    firstSourceSeq: firstSource?.seq ?? null, firstSource: firstSource ? (firstSource.rel ?? firstSource.command?.slice(0, 120)) : null,
    firstSourceVia: firstSource?.via ?? null, firstSourceInWorktree: firstSource?.inWorktree ?? null,
    sourceEdits: sources.length, bashSourceWrites: sources.filter((e) => e.via === "bash").length,
    sourceDenied: ev.filter((e) => e.kind === "source" && e.denied).length, asks: ev.filter((e) => e.asked).length,
    outsideEdits: ev.filter((e) => e.kind === "outside" && went(e)).length,
    // The model approving itself (approve.sh or /praxis:approve from inside the run) is the
    // bypass the marker exists to remove: counted here, never treated as the person's approval.
    modelApproveAttempts: ev.filter((e) => e.kind === "approve-attempt").map((e) => `${e.via}:${(e.command ?? "").slice(0, 80)}${went(e) ? "" : " (blocked)"}`),
    approvedAt: approve?.t ?? null, approvedBeforeSource: approveT && firstSource?.t ? approveT < firstSource.t : null,
  };
  if (!firstSpec) return { ...base, state: "FAIL", reason: firstSource ? "source edited and no spec.md ever written" : "no spec.md written" };
  if (!firstSource) return { ...base, state: "SKIP", reason: "spec written, no source edit went through" };
  return { ...base, state: firstSpec.seq < firstSource.seq ? "PASS" : "FAIL" };
}

// Tokens and cost: per leg from the result line; tokens_total deduplicated by message id over
// main-thread and subagent messages, the formula docs/eval-data/session-metrics.mjs uses.
// PASS = measured: every leg has a result line with a numeric total_cost_usd AND the stream
// carried usage on its messages (tokens > 0). GAP = a leg without a result line (timeout, kill),
// a result without a cost, or a stream with no usage fields — nothing is estimated in its place.
export function measureCost(cell) {
  const legs = cell.transcript.legs.map((l) => {
    const r = l.result;
    const models = r?.modelUsage ? Object.fromEntries(Object.entries(r.modelUsage).map(([k, v]) => [k, {
      input: v.inputTokens ?? 0, output: v.outputTokens ?? 0, cacheRead: v.cacheReadInputTokens ?? 0, cacheCreation: v.cacheCreationInputTokens ?? 0, costUSD: v.costUSD ?? null,
    }])) : null;
    return { leg: l.leg, sessionId: l.sessionId, measured: !!r, cost: r?.cost ?? null, durationMs: r?.durationMs ?? null, numTurns: r?.numTurns ?? null, subtype: r?.subtype ?? null, subagentsSpawned: r?.subagentStats?.spawned ?? null, byType: r?.subagentStats?.by_type ?? null, models };
  });
  const sum = (k) => cell.transcript.messages.reduce((a, m) => a + (m.usage[k] ?? 0), 0);
  // Two token readings. `stream`: per-message usage deduplicated by message id — but a message's
  // first emission carries `output_tokens: 1` and the dedup keeps the first, so its output count
  // is a floor, not a total. `host`: the result line's modelUsage, summed over legs and models;
  // it covers subagents (its costUSD adds up to total_cost_usd) and is what tokensTotal reports
  // when present. The stream sum stays as the fallback and for comparison.
  const stream = { input: sum("input_tokens"), output: sum("output_tokens"), cacheRead: sum("cache_read_input_tokens"), cacheCreation: sum("cache_creation_input_tokens") };
  const host = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  for (const l of legs) for (const m of Object.values(l.models ?? {})) { host.input += m.input; host.output += m.output; host.cacheRead += m.cacheRead; host.cacheCreation += m.cacheCreation; }
  const total = (u) => u.input + u.output + u.cacheRead + u.cacheCreation;
  const usage = total(host) > 0 ? host : stream;
  const tokensTotal = total(usage);
  const reason = legs.length === 0 ? "no leg ran"
    : legs.some((l) => !l.measured) ? "a leg ended without a result line"
    : legs.some((l) => typeof l.cost !== "number") ? "a result line carries no total_cost_usd"
    : tokensTotal === 0 ? "no usage fields on the stream's messages" : null;
  return {
    state: reason ? "GAP" : "PASS", reason: reason ?? undefined,
    cost: legs.reduce((a, l) => a + (l.cost ?? 0), 0), tokensTotal, tokensSource: total(host) > 0 ? "modelUsage" : "stream", usage, stream,
    messages: cell.transcript.messages.length, subagentMessages: cell.transcript.messages.filter((m) => m.sub).length,
    wallMs: cell.meta.wallMs ?? null, legs,
  };
}

export const SCORERS = [
  ["subagents_spawned", scoreSubagents],
  ["barrier_order", scoreBarrier],
  ["rounds", scoreRounds],
  ["decision_present", scoreDecision],
  ["ship_after_approve", scoreShip],
  ["spec_before_source", scoreSpecBeforeSource],
];

// One cell → score.json. A run that stopped on a clarifying question skips every cycle scorer:
// the person's answer was needed and the driver never answers for them. A baseline arm has no
// cycle to score; it exists for the token ratio.
export function scoreCell(dir) {
  const cell = loadCell(dir);
  const arm = cell.meta.arm ?? "cycle";
  const clarified = cell.meta.stopReason === "clarified";
  const skipAll = (reason) => Object.fromEntries(SCORERS.map(([k]) => [k, { state: "SKIP", reason }]));
  const scorers = arm === "baseline" ? skipAll("baseline arm: no cycle to score")
    : clarified ? skipAll("stopped on a clarifying question") : Object.fromEntries(SCORERS.map(([k, f]) => [k, f(cell)]));
  const lastLeg = cell.transcript.legs.at(-1);
  const out = {
    cell: basename(dir), arm, change: cell.change, clarified, stopReason: cell.meta.stopReason ?? null, dryRun: !!cell.meta.dryRun, scenario: cell.meta.scenario ?? null,
    scorers, cost: measureCost(cell),
    finalText: (lastLeg?.finalText ?? lastLeg?.texts.at(-1) ?? "").slice(0, 600),
    runCards: cell.transcript.texts.filter((t) => /RUN CARD/.test(t)).length,
    needsDecisionAtEnd: /Needs your decision/i.test(lastLeg?.finalText ?? ""),
    hookTrace: cell.trace.length, gitLog: cell.gitLog, originLog: cell.originLog,
    timeline: cell.transcript.events.map(({ seq, leg, t, agentType, name, kind, via, rel, inWorktree, round, lens, agent, to, command, denied, asked, refused }) => ({
      seq, leg, t: t ? new Date(t).toISOString() : null, agent: agentType ?? "main", tool: name, kind, via, path: rel, inWorktree: inWorktree || undefined, round, lens, dispatch: agent, to, command: command?.slice(0, 160), denied, asked, refused,
    })),
  };
  writeFileSync(join(dir, "score.json"), JSON.stringify(out, null, 2));
  return out;
}

// ── the comparison with today's measurement ────────────────────────────────────────────────────
// docs/eval-data/matriz.json holds `tokens_total` per task × arm and the praxis-full/baseline
// ratio per task. A ratio needs the same fixture in both arms, so this compares cycle cells with
// baseline cells OF THIS HARNESS and judges the ratio against the matrix's for the same task
// class. No baseline arm, or a class the matrix does not have → GAP, with the reference numbers
// shown and nothing invented.
export function compareWithMatriz({ taskClass = TASK_CLASS, cycleTokens, baselineTokens, matrizPath = MATRIZ }) {
  if (!existsSync(matrizPath)) return { state: "GAP", reason: `no matrix at ${matrizPath}`, taskClass };
  const m = JSON.parse(readFileSync(matrizPath, "utf8"));
  const full = m.cells?.[`${taskClass}|praxis-full`], base = m.cells?.[`${taskClass}|baseline`];
  if (!full || !base) return { state: "GAP", reason: `task class "${taskClass}" has no praxis-full + baseline pair in the matrix (tasks: ${(m.tasks ?? []).join(", ")})`, taskClass };
  const reference = { ratio: full.overhead_ratio_tokens, fullTokens: Math.round(full.tokens_total.mean), baselineTokens: Math.round(base.tokens_total.mean), n: full.n, generated: m.generated };
  if (!(cycleTokens > 0)) return { state: "GAP", reason: "no cycle tokens measured", taskClass, reference };
  if (!(baselineTokens > 0)) return { state: "GAP", reason: "no baseline arm on this fixture (run.mjs --arm both) — a ratio needs the same fixture in both arms; matrix numbers shown for reference only", taskClass, cycleTokens, reference };
  const ratio = cycleTokens / baselineTokens;
  return { state: ratio <= reference.ratio ? "PASS" : "FAIL", taskClass, ratio: +ratio.toFixed(3), cycleTokens, baselineTokens, reference };
}

// ── printing ───────────────────────────────────────────────────────────────────────────────────
const short = (name, s) => {
  if (!s) return "—";
  const d = s.state;
  switch (name) {
    case "subagents_spawned": return `${d} (${s.count ?? "?"})`;
    case "barrier_order": return `${d}${s.rounds ? ` (${s.rounds.length} round${s.rounds.length === 1 ? "" : "s"})` : ""}`;
    case "rounds": return `${d}${s.max !== undefined ? ` (max ${s.max})` : ""}`;
    case "decision_present": return `${d}${s.verdict ? ` ${s.verdict}` : ""}`;
    case "ship_after_approve": return `${d}${s.prCreates ? ` (${s.prCreates.length} pr create)` : ""}`;
    case "spec_before_source": return `${d}${s.specSeq !== null && s.specSeq !== undefined && s.firstSourceSeq !== null && s.firstSourceSeq !== undefined ? ` (#${s.specSeq} < #${s.firstSourceSeq})` : ""}`;
    default: return d;
  }
};
export function renderTable(results) {
  const head = ["cell", "arm", "stop", ...SCORERS.map(([k]) => k), "cost", "tokens"];
  const lines = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  for (const r of results) {
    lines.push(`| ${[r.cell, r.arm, r.stopReason ?? (r.clarified ? "clarified" : "—"), ...SCORERS.map(([k]) => short(k, r.scorers[k])),
      `$${(r.cost.cost ?? 0).toFixed(2)}`, r.cost.tokensTotal.toLocaleString("en-US")].join(" | ")} |`);
  }
  return lines.join("\n");
}
