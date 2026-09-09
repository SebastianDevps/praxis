// boundary.test.mjs — the ratchet over scripts/boundary-audit.mjs.
//
// The audit reports a literal-word clash between a skill's excluded phrase and one of its own
// section labels. Today's seven were all read and all are benign: "Brand Safety" is not defining a
// brand, WCAG ratios are not auditing a built page, the constraints Floor is not the release
// floor. They are recorded here so the gate fails on an EIGHTH rather than on these — a floor that
// describes what holds, not an aspiration.
//
// Read in full: color-expert §Contrast, copywriting §Brand Voice Matching, quality-bar §Floor.
// Judged from a self-explanatory label: the other four, whose shared word is generic ("layout",
// "full", "task", "brand").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boundaryClashes, description } from "../scripts/boundary-audit.mjs";

const BASELINE = new Set([
  "ad-creative::brand",
  "apple-hig::layout",
  "color-expert::full",
  "color-expert::contrast",
  "copywriting::brand",
  "quality-bar::floor",
  "spec-lifecycle::task",
]);

const key = (c) => `${c.id}::${c.hit}`;

test("no skill body takes on work its own description excludes", () => {
  const now = boundaryClashes().map(key);
  assert.deepEqual(now.filter((k) => !BASELINE.has(k)), [], "a new boundary clash appeared");
});

test("the baseline does not rot — a resolved clash is removed from it, not left behind", () => {
  const now = new Set(boundaryClashes().map(key));
  assert.deepEqual([...BASELINE].filter((k) => !now.has(k)), [], "baseline entry no longer occurs; delete it");
});

// ── the audit is armed ────────────────────────────────────────────────────────────────────────
// Without this, the two above pass equally well on an audit that returns nothing. The fixture is
// the real defect: scout's description excluded external investigation while its body carried a
// section headed "**External — …**". A heading-only scan missed it, which is why labels include
// bold lines.

test("the audit catches the shape it was written for", () => {
  const root = mkdtempSync(join(tmpdir(), "boundary-"));
  mkdirSync(join(root, "skills", "recon"), { recursive: true });
  writeFileSync(join(root, "skills", "recon", "SKILL.md"),
    "---\nname: recon\ndescription: Recon of this repo. NOT multi-source external investigation (that is `deep-research`).\n---\n\n" +
    "## Two tracks (run both)\n\n**Internal — what the repo has**\n- prior art\n\n" +
    "**External — what's already been solved**\n- libraries that cover the need\n");
  const found = boundaryClashes(root);
  assert.deepEqual(found.map((c) => `${c.id}::${c.hit}`), ["recon::external"]);
});

test("an explicit hand-off is not a clash", () => {
  const root = mkdtempSync(join(tmpdir(), "boundary-"));
  mkdirSync(join(root, "skills", "recon"), { recursive: true });
  writeFileSync(join(root, "skills", "recon", "SKILL.md"),
    "---\nname: recon\ndescription: Recon of this repo. NOT multi-source external investigation (that is `deep-research`).\n---\n\n" +
    "## Scope\n\n**External work goes to `deep-research`** — this skill stops at the repo edge.\n");
  assert.deepEqual(boundaryClashes(root), []);
});


// ── the other half: a clause must EXIST, and must not quietly disappear ───────────────────────
//
// Everything above fires only when a clause is CONTRADICTED by the body. Nothing fired when one was
// ABSENT. T07 deleted a whole `NOT` clause from a shipped skill, ran every gate, and every gate
// stayed green — the routing audit scored the mutant 0.6 points BETTER, because a clause can only
// cost recall: `routing-audit.mjs:146` strips clauses from the collision text and never from the
// ranking text. A gate that pays you to delete the thing it guards is worse than no gate at all.
//
// Three assertions, because the first two alone still passed the mutation that motivated them —
// measured, not assumed: removing one of `dependency-adoption`'s two clauses left it with one, so a
// "carries at least one" check stayed green while a declared boundary vanished. The third is the
// ratchet that actually holds.
//
// SHAPE — deliberately broader than `boundary-audit.mjs`'s CLAUSE_RE, because the narrow pattern is
// wrong about what a clause looks like, not because the corpus is sloppy. Five descriptions qualify
// the sibling with an article and its kind — "(that is the `reviewer` agent)", "(that is the
// `security` skill)" — and at least one MUST: a `security` skill and a `security` agent both exist,
// so `refuter-security` cannot say which it means without the noun. Two name a family glob, "(that
// is a `design-system-*` skill)". Forcing those five into the bare shape would be five false
// rewrites to satisfy a regex. What does not move: a real sibling is named.
//
// SCOPE — skills and agents, the two kinds `routing-audit.mjs` ranks against one another. Crafts
// and pipelines are excluded on the evidence, not by preference: 0 of 11 carry a clause, because a
// craft is always-on and a pipeline is invoked by name, so neither competes for a prompt. Asserting
// it there would be inventing a convention rather than holding one.

const ROOT = new URL("..", import.meta.url).pathname;

const DECLARED = /\bNOT\s+[^(]+?\s*\(that is\s*(?:(?:an?|the)\s+)?`([a-z0-9*-]+)`(?:\s+(?:skill|agent|craft|pipeline)s?)?\)/g;

// Keys are `kind:id`. A bare id collides: `security` is both a skill and an agent, and they carry
// different boundaries.
const routed = (root) => {
  const out = [];
  const skillsDir = join(root, "skills");
  if (existsSync(skillsDir))
    for (const id of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const file = join(skillsDir, id, "SKILL.md");
      if (existsSync(file)) out.push({ key: `skill:${id}`, id, file });
    }
  const agentsDir = join(root, "agents");
  if (existsSync(agentsDir))
    for (const f of readdirSync(agentsDir).filter((n) => n.endsWith(".md")).sort())
      out.push({ key: `agent:${f.slice(0, -3)}`, id: f.slice(0, -3), file: join(agentsDir, f) });
  return out;
};

const clauses = (file) => [...description(readFileSync(file, "utf8")).matchAll(DECLARED)].map((m) => m[1]).sort();

// The two resources whose exclusion names no sibling, because there is no single sibling to name.
// Both are routers: what they exclude is EVERY specialist at once, and citing one of them would be
// a lie that also ranks. Enumerated, not pattern-matched — a third cannot join this list silently,
// and the rot test below deletes an entry the moment it stops being true.
const ROUTERS = new Map([
  ["skill:using-praxis", "NOT any single discipline — this is the router that dispatches to them"],
  ["agent:orchestrator", "NOT an implementer — it dispatches and never writes production code itself"],
]);

test("every routed skill and agent declares a boundary", () => {
  const bare = routed(ROOT).filter(({ key, file }) => !ROUTERS.has(key) && clauses(file).length === 0).map((r) => r.key);
  assert.deepEqual(bare, [],
    "description carries no `NOT … (that is `sibling`)` clause; add one, or justify it in ROUTERS");
});

test("every declared boundary names a resource that exists", () => {
  const names = new Set(routed(ROOT).map((r) => r.id));
  // A glob names a family: `design-system-*` resolves if any resource starts with `design-system-`.
  const resolves = (s) => (s.includes("*")
    ? [...names].some((n) => n.startsWith(s.slice(0, s.indexOf("*"))))
    : names.has(s));
  const dangling = routed(ROOT).flatMap(({ key, file }) => clauses(file).filter((s) => !resolves(s)).map((s) => `${key} -> ${s}`));
  assert.deepEqual(dangling, [], "boundary clause cites a sibling that is not in the corpus");
});

test("the router exemption does not rot — an entry that gained a clause is deleted, not left behind", () => {
  const byKey = new Map(routed(ROOT).map((r) => [r.key, r.file]));
  const stale = [...ROUTERS.keys()].filter((k) => !byKey.has(k) || clauses(byKey.get(k)).length > 0);
  assert.deepEqual(stale, [], "exempted resource no longer needs the exemption; remove it from ROUTERS");
});

// ── the no-erosion ratchet ────────────────────────────────────────────────────────────────────
//
// The recorded boundary graph: which neighbour each description discriminates itself against. The
// assertion is one-directional on purpose — the frozen set must remain a SUBSET of what is declared
// today. Adding a boundary passes silently, which is the direction the doctrine wants to be cheap.
// Deleting one fails, and the only way to make it pass is to edit this table, which is the argued
// act ADR-007 exists to force. Ratchets up, never down; a new resource needs no row here because
// the presence test above already covers it.
const BOUNDARIES = new Map([
  ["skill:ad-creative", ["brand", "copywriting"]],
  ["skill:agentic-lifecycle", ["autonomous-loop", "spec-lifecycle"]],
  ["skill:apple-hig", ["design-system-*", "frontend-design"]],
  ["skill:architecture-evaluation", ["codebase-design", "project-teardown"]],
  ["skill:autonomous-loop", ["agentic-lifecycle", "subagent-driven-development"]],
  ["skill:baseline-status", ["docs-seeker"]],
  ["skill:brainstorming", ["strategy-compare", "writing-plans"]],
  ["skill:brand", ["color-expert", "creative-director"]],
  ["skill:buy-vs-build", ["decision-challenge", "dependency-adoption", "strategy-compare"]],
  ["skill:codebase-design", ["frontend-design", "strategy-compare"]],
  ["skill:color-expert", ["brand", "design-review"]],
  ["skill:copywriting", ["brand", "prose-tells"]],
  ["skill:creative-director", ["brand", "frontend-design"]],
  ["skill:data-visualization", ["design-system-bento", "frontend-design"]],
  ["skill:decision-challenge", ["refuter-*", "strategy-compare"]],
  ["skill:deck-builder", ["copywriting", "editorial-layout"]],
  ["skill:deep-research", ["dependency-adoption", "docs-seeker", "scout"]],
  ["skill:dependency-adoption", ["security", "strategy-compare"]],
  ["skill:design-review", ["frontend-design", "reviewer"]],
  ["skill:design-system-bento", ["design-system-clean", "design-system-swiss"]],
  ["skill:design-system-brutalist", ["design-system-clean", "design-system-swiss"]],
  ["skill:design-system-clean", ["design-system-bento", "design-system-brutalist"]],
  ["skill:design-system-swiss", ["design-system-clean", "editorial-layout"]],
  ["skill:docs-seeker", ["baseline-status", "deep-research"]],
  ["skill:editorial-layout", ["deck-builder", "design-system-swiss"]],
  ["skill:frontend-design", ["creative-director", "design-review"]],
  ["skill:learn-graduate", ["learn-prune", "praxis-memory"]],
  ["skill:learn-prune", ["learn-graduate", "praxis-memory"]],
  ["skill:praxis-memory", ["learn-graduate", "learn-prune"]],
  ["skill:project-teardown", ["deep-research", "scout"]],
  ["skill:prose-tells", ["brand", "copywriting"]],
  ["skill:quality-bar", ["release-readiness", "test-coverage-plan"]],
  ["skill:release-readiness", ["quality-bar", "security"]],
  ["skill:scout", ["deep-research", "project-teardown", "strategy-compare"]],
  ["skill:security", ["reviewer"]],
  ["skill:spec-lifecycle", ["agentic-lifecycle", "writing-plans"]],
  ["skill:strategy-compare", ["brainstorming"]],
  ["skill:subagent-driven-development", ["autonomous-loop", "writing-plans"]],
  ["skill:systematic-debugging", ["test-coverage-plan"]],
  ["skill:tdd", ["systematic-debugging", "test-coverage-plan"]],
  ["skill:test-coverage-plan", ["quality-bar", "web-testing"]],
  ["skill:web-testing", ["systematic-debugging", "test-coverage-plan"]],
  ["skill:writing-plans", ["brainstorming", "subagent-driven-development"]],
  ["agent:analyst", ["researcher", "reviewer"]],
  ["agent:backend", ["design", "platform"]],
  ["agent:design", ["backend", "reviewer"]],
  ["agent:engineer", ["backend", "platform"]],
  ["agent:platform", ["backend", "engineer"]],
  ["agent:refuter-correctness", ["refuter-security", "reviewer"]],
  ["agent:refuter-security", ["refuter-correctness", "security"]],
  ["agent:refuter-tests", ["test-coverage-plan", "web-testing"]],
  ["agent:researcher", ["reviewer"]],
  ["agent:reviewer", ["researcher"]],
  ["agent:security", ["refuter-security", "reviewer"]],
]);

const eroded = (root, frozen) => {
  const now = new Map(routed(root).map((r) => [r.key, new Set(clauses(r.file))]));
  return [...frozen].flatMap(([key, siblings]) => (now.has(key)
    ? siblings.filter((s) => !now.get(key).has(s)).map((s) => `${key} -> ${s}`)
    : [`${key} (resource is gone)`]));
};

test("a recorded boundary is never silently deleted", () => {
  assert.deepEqual(eroded(ROOT, BOUNDARIES), [],
    "a description dropped a boundary it used to declare; restore it, or delete the row and say why");
});

// ── the presence check and the ratchet are armed ──────────────────────────────────────────────
// Without these, all four above pass equally well on a scan that finds nothing — which is exactly
// the failure mode T07 measured in the gate they replace.

test("the presence check catches a description with no boundary clause", () => {
  const root = mkdtempSync(join(tmpdir(), "declared-"));
  mkdirSync(join(root, "skills", "recon"), { recursive: true });
  writeFileSync(join(root, "skills", "recon", "SKILL.md"),
    "---\nname: recon\ndescription: Recon of this repo — prior art, conventions, installed deps.\n---\n\n## When to run\n");
  assert.deepEqual(routed(root).filter((r) => clauses(r.file).length === 0).map((r) => r.key), ["skill:recon"]);
});

test("the qualified shape is a clause; a sibling that does not exist is not", () => {
  const root = mkdtempSync(join(tmpdir(), "declared-"));
  mkdirSync(join(root, "skills", "recon"), { recursive: true });
  mkdirSync(join(root, "agents"), { recursive: true });
  writeFileSync(join(root, "agents", "reviewer.md"), "---\nname: reviewer\ndescription: Reviews. NOT recon (that is `recon`).\n---\n");
  writeFileSync(join(root, "skills", "recon", "SKILL.md"),
    "---\nname: recon\ndescription: Recon. NOT judging quality (that is the `reviewer` agent), NOT external work (that is `deep-research`).\n---\n\n## When to run\n");
  assert.deepEqual(clauses(join(root, "skills", "recon", "SKILL.md")), ["deep-research", "reviewer"]);
  assert.deepEqual(routed(root).filter((r) => clauses(r.file).length === 0), []);
});

test("the ratchet catches a boundary deleted from a description that still has others", () => {
  const root = mkdtempSync(join(tmpdir(), "declared-"));
  mkdirSync(join(root, "skills", "recon"), { recursive: true });
  writeFileSync(join(root, "skills", "recon", "SKILL.md"),
    "---\nname: recon\ndescription: Recon. NOT external work (that is `deep-research`).\n---\n\n## When to run\n");
  const frozen = new Map([["skill:recon", ["deep-research", "strategy-compare"]]]);
  assert.deepEqual(eroded(root, frozen), ["skill:recon -> strategy-compare"]);
});

// ── the regression that the case-sensitivity fix closes ───────────────────────────────────────
// `boundary-audit.mjs` matched `/gi`, so the lowercase "not" in ordinary prose opened a clause and
// the lazy `[^(]+?` ran from there to the next "(that is `x`)" — swallowing the whole positive
// claim into the excluded phrase. `project-teardown` says "a codebase you do not own", and every
// noun in its own claim then counted as excluded vocabulary. Two of the nine clashes reported
// before this fix were that artefact; the labels they accused were innocent.
test("prose `not` is not a boundary clause — only the doctrine's uppercase NOT is", () => {
  const root = mkdtempSync(join(tmpdir(), "boundary-"));
  mkdirSync(join(root, "skills", "teardown"), { recursive: true });
  writeFileSync(join(root, "skills", "teardown", "SKILL.md"),
    "---\nname: teardown\ndescription: Use when taking apart a codebase you do not own — "
    + "mapping its request lifecycle. NOT recon (that is `scout`).\n---\n\n"
    + "## Request lifecycle\n\n- the entry point first\n");
  // The clause excludes "recon", which shares nothing with "Request lifecycle". Under /gi the match
  // opened at the lowercase "not" in "do not own", so the excluded phrase became "own — mapping its
  // request lifecycle. NOT recon" — the skill's own claim — and the label clashed with itself.
  assert.deepEqual(boundaryClashes(root), []);
});
