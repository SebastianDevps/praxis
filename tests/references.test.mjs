// Referential integrity: a routing table that names an agent which does not
// exist sends the orchestrator to dispatch nothing. Nothing caught this before,
// so `platform` and `incident-responder` sat in the routing table unnoticed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const dirNames = (d) =>
  readdirSync(join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

const AGENTS = new Set(
  readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)),
);
const CRAFTS = dirNames("crafts");
// A routing table cell may name an agent OR the discipline skill for that row.
const SKILLS = new Set(dirNames("skills"));

// Backticked kebab tokens from the ONE table whose header names a specialist
// column. Scanning every table would also pick up the Run Card's field names.
function routedAgents(body, headerWord) {
  const names = new Set();
  let inTable = false;
  for (const line of body.split("\n")) {
    const isRow = line.trim().startsWith("|");
    if (!isRow) { inTable = false; continue; }
    if (line.includes(headerWord)) { inTable = true; continue; }
    if (!inTable) continue;
    for (const cell of line.split("|")) {
      const m = cell.trim().match(/^`([a-z][a-z0-9-]*)`$/);
      if (m) names.add(m[1]);
    }
  }
  return [...names];
}

// The Run Card's `approach:` line enumerates dispatch targets in prose.
function approachTargets(body) {
  const line = body.split("\n").find((l) => l.includes("approach:") && l.includes("→"));
  if (!line) return null;
  return line
    .split("→")[1]
    .split(/[/|<>]/)
    .map((s) => s.trim())
    .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s !== "inline" && s !== "delegate");
}

// agents/design.md routes by INPUT TYPE, not by specialist, so its table header differs and the
// sweep above never reached it — a row there could name a skill that does not exist and nothing
// would say so. Found by a refuter, not by the suite.
for (const [file, header] of [
  ["agents/orchestrator.md", "Specialist"],
  ["skills/using-praxis/SKILL.md", "Specialist"],
  ["agents/design.md", "Route to"],
]) {
  test(`${file}: every routed specialist exists`, () => {
    const unresolved = routedAgents(read(file), header).filter((n) => !AGENTS.has(n) && !SKILLS.has(n));
    assert.deepEqual(unresolved, [], `routes to nonexistent agents or skills: ${unresolved}`);
  });
}

for (const file of ["hooks/context/contract.md", "skills/using-praxis/SKILL.md"]) {
  test(`${file}: every Run Card approach target exists`, () => {
    const targets = approachTargets(read(file));
    assert.ok(targets, `${file} lost its Run Card approach line`);
    const unresolved = targets.filter((n) => !AGENTS.has(n));
    assert.deepEqual(unresolved, [], `approach line names nonexistent agents: ${unresolved}`);
  });
}

// Two bugs lived in the old inline version of this parser, both found by a refuter with repros.
// It split the WHOLE frontmatter on /^\s*requires:\s*$/m and took [1] — so any unrelated
// `requires:` key added earlier (`env:\n  requires:\n    - node18`) shadowed the real block, and
// the `\s*$` anchor meant the inline YAML form `requires: [a, b]` parsed as empty, reporting a
// correctly-configured agent as violating the rule it satisfies. A gate that fires on correct work
// is the failure this repo keeps re-learning. Scope to `craft:` first, then accept both shapes.
function declaredCrafts(agent) {
  const fm = read(`agents/${agent}.md`).split("---")[1] ?? "";
  const scoped = fm.split(/^\s*craft:\s*$/m)[1] ?? fm;
  const inline = scoped.match(/^\s*requires:\s*\[([^\]]*)\]/m);
  if (inline) return inline[1].split(",").map((s) => s.trim()).filter(Boolean);
  const block = scoped.split(/^\s*requires:\s*$/m)[1];
  if (block === undefined) return null;
  const out = [];
  let started = false;
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*-\s+(\S+)/);
    if (m) { out.push(m[1]); started = true; continue; }
    if (started || line.trim() !== "") break;
  }
  return out;
}

test("every craft an agent requires exists on disk", () => {
  const missing = [];
  for (const agent of AGENTS) {
    const declared = declaredCrafts(agent);
    if (declared === null) continue;
    assert.ok(declared.length > 0, `${agent} declares requires: but no craft was parsed`);
    for (const c of declared) if (!CRAFTS.includes(c)) missing.push(`${agent} → ${c}`);
  }
  assert.deepEqual(missing, [], `agents require nonexistent crafts: ${missing}`);
});

// The craft layer had grown asymmetric without anyone noticing: three design crafts required by
// `design`, and every engineering agent requiring exactly one (`minimalism`). Nothing said so,
// because nothing was watching the ratio. This does not police the ratio — it pins the one craft
// that must reach every agent allowed to write or judge code, so removing it is a decision someone
// has to make in the open rather than an omission that compounds.
// The three refuter-* agents were missing from this list while the test's own title claimed to
// cover "judges code" — and judging whether a gate can actually fail is the entire content of the
// craft. `researcher` and `design` stay out on purpose: one never judges, the other runs the
// design crafts. Excluding an agent has to be a decision, which is why they are named here.
const CODE_AGENTS = [
  "engineer", "backend", "platform", "reviewer", "security",
  "refuter-correctness", "refuter-security", "refuter-tests",
];

test("every agent that writes or judges code requires evidence-discipline", () => {
  const missing = CODE_AGENTS.filter((a) => !(declaredCrafts(a) ?? []).includes("evidence-discipline"));
  assert.deepEqual(missing, [], `these agents may write code with no evidence discipline: ${missing}`);
});

// Four surfaces recite the always-on craft list as prose. Adding a sixth craft left all four
// reciting five — a list that is wrong is worse than no list, because a reader trusts it. The
// AGENTS.md gate below did not catch it: "documented somewhere in the file" is satisfied by the
// crafts table while the always-on sentence three sections away still lies.
const CRAFT_RECITERS = [
  "hooks/context/contract.md",
  "skills/using-praxis/SKILL.md",
  "skills/using-praxis/references/claude-code-tools.md",
  ".cursor/rules/praxis.mdc",
];

test("every surface that recites the craft list recites all of them", () => {
  for (const f of CRAFT_RECITERS) {
    // `src.includes(c)` over the whole file was the first version, and a refuter broke it: drop a
    // craft from the recited sentence, leave the word in a comment elsewhere, gate stays green.
    // The same whole-file-substring mistake as the phase gate, made twice in one day. Find the
    // recital — the densest run of craft names — and assert inside THAT.
    const src = read(f);
    const window = src
      .split(/(?<=\.)\s/)
      .map((s) => ({ s, n: CRAFTS.filter((c) => s.includes(c)).length }))
      .sort((a, b) => b.n - a.n)[0];
    assert.ok(window && window.n >= 3, `${f} no longer recites a craft list — remove it from CRAFT_RECITERS`);
    const missing = CRAFTS.filter((c) => !window.s.includes(c));
    assert.deepEqual(missing, [], `${f} recites the always-on crafts but omits ${missing}`);
  }
});

test("every craft on disk is documented in AGENTS.md", () => {
  const agentsMd = read("AGENTS.md");
  const undocumented = CRAFTS.filter((c) => !agentsMd.includes(`\`${c}\``));
  assert.deepEqual(undocumented, [], `crafts exist but AGENTS.md never mentions them: ${undocumented}`);
});

// The router's route table pairs a specialist with the discipline skill for that
// row. If the agent does not declare that skill, the dispatch never carries it —
// the table promises a pairing the frontmatter does not deliver. This is what
// left `reviewer` paired with `design-review` in two route tables while
// declaring no skills at all.
test("every agent+skill pairing in the route table is declared by that agent", () => {
  const declaredSkills = (agent) => {
    const fm = read(`agents/${agent}.md`).split("---")[1] ?? "";
    const block = fm.split(/^skills:\s*$/m)[1];
    if (!block) return [];
    const out = [];
    let started = false;
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*-\s+(\S+)/);
      if (m) { out.push(m[1]); started = true; continue; }
      if (started || line.trim() !== "") break;
    }
    return out;
  };

  const broken = [];
  let pairs = 0;
  for (const file of ["skills/using-praxis/SKILL.md", ".cursor/rules/praxis.mdc"]) {
    let inTable = false;
    for (const line of read(file).split("\n")) {
      if (!line.trim().startsWith("|")) { inTable = false; continue; }
      if (line.includes("Specialist")) { inTable = true; continue; }
      if (!inTable) continue;
      const cells = line.split("|").map((c) => c.trim());
      const agent = cells.find((c) => /^`[a-z-]+`$/.test(c) && AGENTS.has(c.slice(1, -1)))?.slice(1, -1);
      const skill = cells.slice(-2)[0]?.match(/^`([a-z-]+)`$/)?.[1];
      if (!agent || !skill || !SKILLS.has(skill)) continue;
      pairs++;
      if (!declaredSkills(agent).includes(skill)) broken.push(`${file}: ${agent} is paired with ${skill} but does not declare it`);
    }
  }
  assert.ok(pairs >= 4, `only ${pairs} pairings parsed — the table format probably changed`);
  assert.deepEqual(broken, []);
});

// Counts in prose go stale silently, and a README that misstates what ships is the cheapest kind
// of lie to tell for fourteen releases without noticing. Assert the table against the filesystem.
test("the README resource table matches what is on disk", () => {
  const readme = read("README.md");
  const actual = {
    skills: dirNames("skills").length,
    agents: readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).length,
    crafts: dirNames("crafts").length,
    pipelines: readdirSync(join(ROOT, "pipelines")).filter((f) => f.endsWith(".md")).length,
    commands: readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).length,
  };
  for (const [kind, n] of Object.entries(actual)) {
    // Both orders, because the README's table layout is a presentation choice and this gate is
    // about the number being true — `| **skills** | 36 |` and `| **36** skills |` both count.
    // Pinning one layout made a rewrite look like a stale-count failure, which is how a gate
    // teaches people to edit the test instead of the fact.
    const m =
      new RegExp(`\\|\\s*\\*\\*${kind}\\*\\*\\s*\\|\\s*(\\d+)\\s*\\|`).exec(readme) ??
      new RegExp(`\\|\\s*\\*\\*(\\d+)\\*\\*\\s+${kind}\\s*\\|`).exec(readme);
    assert.ok(m, `README has no count row for ${kind}`);
    assert.equal(
      Number(m[1]),
      n,
      `README says ${m[1]} ${kind}, the repo has ${n}`,
    );
  }
});
