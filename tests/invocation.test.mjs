// invocation.test.mjs — is a resource NAMED, or is the model TOLD to invoke it?
//
// Phase E measured `Skill` = 0 invocations across all 16 Praxis cells while the routing audit
// showed the descriptions were fine. Healthy descriptions plus zero invocations means the failure
// is not discovery — it is that nothing instructs the model to CALL anything. The router said
// "`scout` the repo for prior art": the resource id read as an English verb, indistinguishable
// from prose, so the model did the reconnaissance itself and never invoked the skill.
//
// The fix is host-neutral by construction. Praxis speaks in ACTIONS and keeps tool names in
// references/<host>-tools.md ("Invoke a skill | `Skill` / `skill` / `activate_skill` / loads
// natively"). So the gate requires the declared action verb, never a tool name — writing
// `Call the Skill tool` here would hardcode Claude Code into the host-neutral layer.
//
// WHAT IT GATES — units that INSTRUCT: list items in a procedure, and table cells under a column
// whose header is not a destination role.
//
// WHAT IT DOES NOT GATE, stated rather than discovered later:
//   - prose paragraphs. "`decision-challenge` carries a different five-state table" refers to a
//     resource instead of instructing its use, and separating the two needs grammar this has no
//     business guessing at. A directive written as a bare paragraph slips through.
//   - destination columns (`| Domain | Specialist |`, `| Input type | Route to |`). The header
//     already declares the cell's role, so the bare name is data, not a missing instruction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The action vocabulary declared in skills/using-praxis/SKILL.md and mapped per host in its
// references. `see` covers "invoke X — see Y for the doctrine"; it is a read, which is an action.
export const ACTION_VERB = /\b(invoke|invokes|invoking|dispatch|dispatches|dispatching|read|reads|see)\b/i;

// The verb must GOVERN the mention, not merely appear earlier in the unit. The first version of
// this gate scanned the whole prefix and passed the very defect it was written for: "read the
// reference/screenshot closely, `scout` the repo" satisfies a prefix scan through an unrelated
// `read` four words upstream. Caught by mutating the real router rather than trusting the
// synthetic case.
//
// The second version used a 3-token window, which broke on the kernel's legitimate
// "dispatch the refuter panel (`refuter-correctness`, …)" — the verb governs a named group four
// tokens back. Widening to four would have re-admitted the original bug, whose stray verb is also
// four tokens back. Distance cannot separate them; clause structure can.
//
// So: the span is from the nearest clause boundary to the mention. A comma opens a new coordinate
// clause and does not carry the previous verb with it ("…closely, `scout` the repo" → the span is
// empty, caught); a parenthesis does not ("dispatch the refuter panel (" → the span holds the
// verb, allowed).
//
// One more case the boundary alone gets wrong: the SECOND member of an enumeration. In
// "(`refuter-correctness`, `refuter-tests`)" the comma leaves the second name with an empty span,
// though the same verb plainly governs both. So an empty span inherits — but ONLY from a
// predecessor that was itself governed. That distinction is what keeps the original bug caught:
// in "closely, `scout` the repo for prior art, `docs-seeker` for unfamiliar APIs" the first
// mention is ungoverned, so the second inherits nothing and both are reported.
const CLAUSE_BOUNDARY = /[,;:]/;
const governingSpan = (prefix) => prefix.split(CLAUSE_BOUNDARY).pop();
const isEnumerationTail = (span) => span.replace(/`[^`]*`/g, "").replace(/[\s()\-—.]/g, "") === "";

// A column header naming where a row ROUTES TO. Matched per column cell, not against the whole
// header line: `| Domain | Specialist |` must exempt column 2 without exempting column 1.
const DESTINATION_ROLE = /^(route to|specialist|specialist agent|discipline skill|skill|agent|craft)$/i;

export const RESOURCES = new Set([
  ...readdirSync(join(ROOT, "skills")),
  ...readdirSync(join(ROOT, "agents")).map((f) => f.replace(/\.md$/, "")),
]);

const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());

// Returns the units that INSTRUCT, as plain strings. A wrapped list item is one unit: step 2 of
// the router spans three physical lines and its verb sits on the first.
// `allParagraphsInstruct` is for hooks/context/contract.md. Every other file mixes explanation
// with instruction, so a bare paragraph there is usually explanation and gating it would drown the
// signal. The kernel is different by construction: its own header says it is the operating
// contract injected on every turn, and every line in it is a directive. Gating it as prose-exempt
// would have passed it vacuously — the parser emits no units for a file with no list items, and a
// gate that sees nothing reports PASS.
export function instructionUnits(markdown, allParagraphsInstruct = false) {
  const out = [];
  // Frontmatter only when the file OPENS with a fence. The first version assumed every target had
  // one and skipped hooks/context/contract.md whole — it has no frontmatter, so the counter never
  // reached 2 and every line was dropped. It reported PASS on a file it never read. The armed test
  // below is the only reason that surfaced.
  const hasFrontmatter = /^---\r?\n/.test(markdown);
  let fm = hasFrontmatter ? 0 : 2;
  let fence = false, header = null, buf = [];
  const flush = () => { if (buf.length) { out.push(buf.join(" ")); buf = []; } };
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trim() === "---" && fm < 2) { fm++; flush(); continue; }
    if (fm < 2) continue;                                   // frontmatter
    if (/^\s*```/.test(line)) { fence = !fence; flush(); continue; }
    if (fence) continue;                                    // fenced code
    if (/^#/.test(line)) { flush(); header = null; continue; }
    if (/^\s*$/.test(line)) { flush(); header = null; continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;       // the |---|---| separator
      if (header === null) { header = cells(line); continue; }
      cells(line).forEach((cell, i) => {
        if (!DESTINATION_ROLE.test(header[i] ?? "")) out.push(cell);
      });
      continue;
    }
    header = null;
    if (/^\s*<!--/.test(line)) { flush(); continue; }        // <!-- only:mode --> fences
    if (/^\s*([-*]|\d+\.)\s/.test(line)) flush();            // a new list item opens a new unit
    else if (buf.length === 0 && !allParagraphsInstruct) continue;
    buf.push(line.trim());
  }
  flush();
  return out;
}

export function bareMentions(markdown, allParagraphsInstruct = false) {
  const found = [];
  for (const unit of instructionUnits(markdown, allParagraphsInstruct)) {
    let previousGoverned = false;
    for (const m of unit.matchAll(/`([a-z][a-z0-9-]+)`/g)) {
      if (!RESOURCES.has(m[1])) continue;
      const span = governingSpan(unit.slice(0, m.index));
      const governed = ACTION_VERB.test(span) || (isEnumerationTail(span) && previousGoverned);
      if (!governed) found.push({ id: m[1], unit });
      previousGoverned = governed;
    }
  }
  return found;
}

const KERNEL = "hooks/context/contract.md";

const TARGETS = [
  KERNEL,
  "skills/using-praxis/SKILL.md",
  ...readdirSync(join(ROOT, "agents")).map((f) => `agents/${f}`),
];

for (const rel of TARGETS) {
  test(`${rel}: every instruction invokes, none merely names`, () => {
    const bare = bareMentions(readFileSync(join(ROOT, rel), "utf8"), rel === KERNEL);
    assert.deepEqual(
      bare.map((b) => `\`${b.id}\` in: ${b.unit.slice(0, 90)}`),
      [],
      `a resource named without an action verb reads as prose, and Phase E measured what that costs`,
    );
  });
}

// ── the gate is armed ─────────────────────────────────────────────────────────────────────────
// Without these, the two above pass just as well on a parser that returns nothing.

test("the gate sees the router's loop — it is not skipping the file", () => {
  const units = instructionUnits(readFileSync(join(ROOT, "skills/using-praxis/SKILL.md"), "utf8"));
  const withResource = units.filter((u) =>
    [...u.matchAll(/`([a-z][a-z0-9-]+)`/g)].some((m) => RESOURCES.has(m[1])));
  // 4 is measured, not aspirational: steps 2, 3, 5 and 6 of the visible loop are the only units
  // that name a resource. Below it, either the parser broke or the loop stopped routing — both
  // are worth stopping for. Raise it only when a change actually adds a routing step.
  assert.ok(withResource.length >= 4, `only ${withResource.length} instruction units mention a resource`);
});

test("the gate bites — a name used as a verb is caught", () => {
  const bare = bareMentions("---\nx: 1\n---\n\n1. **Research** — `scout` the repo for prior art.\n");
  assert.deepEqual(bare.map((b) => b.id), ["scout"]);
});

test("an unrelated verb upstream does not satisfy the gate — the regression that shipped once", () => {
  const md = "---\nx: 1\n---\n\n1. **Research** — read the screenshot closely, `scout` the repo.\n";
  assert.deepEqual(bareMentions(md).map((b) => b.id), ["scout"]);
});

test("a verb governing a parenthesised group reaches its members", () => {
  const md = "---\nx: 1\n---\n\n1. Before done, dispatch the refuter panel (`refuter-correctness`, `refuter-tests`).\n";
  assert.deepEqual(bareMentions(md), []);
});

test("the gate passes the fixed form", () => {
  assert.deepEqual(bareMentions("---\nx: 1\n---\n\n1. **Research** — invoke `scout` for prior art.\n"), []);
});

test("a destination column is data, not a missing instruction", () => {
  const md = "---\nx: 1\n---\n\n| Domain | Specialist |\n|---|---|\n| UI | `design` |\n";
  assert.deepEqual(bareMentions(md), []);
});

test("an Action column is an instruction and is gated", () => {
  const md = "---\nx: 1\n---\n\n| Input | Action |\n|---|---|\n| Bug | `systematic-debugging` first |\n";
  assert.deepEqual(bareMentions(md).map((b) => b.id), ["systematic-debugging"]);
});

// ── the kernel ────────────────────────────────────────────────────────────────────────────────
// The kernel is the surface that matters most and the one the first pass missed. using-praxis
// loads only when the router skill activates; the kernel is injected on EVERY turn and into every
// dispatched specialist. A live cell (2026-09-02, claude 2.1.259, --plugin-dir, plan mode)
// measured 0 Skill invocations with the router fixed and the kernel still saying "scout the repo
// for prior art" — the resource id as a bare English verb, not even backticked. That is what
// Phase E's "what acted was the injected context, not the components" actually was.

test("the kernel routes — it names resources, not activities", () => {
  const units = instructionUnits(readFileSync(join(ROOT, KERNEL), "utf8"), true);
  const withResource = units.filter((u) =>
    [...u.matchAll(/`([a-z][a-z0-9-]+)`/g)].some((m) => RESOURCES.has(m[1])));
  // 2 measured, not guessed: "Research before deciding" and "Deep mode" — the refuter wave shares
  // the Deep mode paragraph, so it is not a third unit. Written down twice from a guess and
  // corrected twice by the corpus; the floor is what holds today.
  assert.ok(withResource.length >= 2, `only ${withResource.length} kernel directives name a resource`);
});

// A DENYLIST, not a general check, and narrow on purpose. The general form — a resource id used
// unbackticked as an English verb — cannot be detected without false-positiving on `security`,
// `design`, `brand` and `platform`, which are ordinary words. These two phrasings are the ones
// that actually shipped and cost 0 invocations; a new one in this shape will not be caught here.
const SHIPPED_BARE_PHRASINGS = [/scout the repo/i, /fetch current docs/i];

test("the kernel does not tell the model to do the skill's job itself", () => {
  const text = readFileSync(join(ROOT, KERNEL), "utf8");
  const hits = SHIPPED_BARE_PHRASINGS.filter((re) => re.test(text)).map(String);
  assert.deepEqual(hits, [], "a bare activity phrasing is back in the kernel");
});
