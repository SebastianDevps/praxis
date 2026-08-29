// Routing evals and the audit that reads them.
//
// Two jobs, and the second is the one that matters. The first is the ordinary lint: every skill
// carries enough cases, and every `route_to` names something real — the class of drift that put two
// nonexistent agents in a routing table here and went unnoticed until someone read it by hand.
//
// The second is guarding the INSTRUMENT. `routing-audit.mjs` shipped with a triggers parser
// anchored at the wrong indentation: it matched nothing, every skill ranked without its triggers,
// and the numbers still looked plausible. Nothing failed. A measurement that silently measures
// less than it claims is worse than no measurement, because it is trusted. So the loaders are
// asserted against known content, not just called.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCorpus, loadCases, buildRanker, audit, FLOORS, stripBoundaries } from "../scripts/routing-audit.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SKILLS = readdirSync(join(ROOT, "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const AGENTS = readdirSync(join(ROOT, "agents"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3));
const RESOURCES = new Set([...SKILLS, ...AGENTS]);

const MIN_TRIGGER = 5;
const MIN_NOT_TRIGGER = 4;
const MIN_CAPABILITY = 1;

const casesPath = (id) => join(ROOT, "skills", id, "evals", "cases.yaml");
const raw = (id) => readFileSync(casesPath(id), "utf8");

// ── the lint ──────────────────────────────────────────────────────────────────────────────────

test("every skill carries routing cases", () => {
  const missing = SKILLS.filter((id) => !existsSync(casesPath(id)));
  assert.deepEqual(missing, [], `skills without evals/cases.yaml: ${missing.join(", ")}`);
});

for (const id of SKILLS) {
  test(`${id}: cases meet the minimums`, () => {
    const lines = raw(id).split(/\r?\n/);
    // Line-scanned. The first version searched from `slice(1)` for the next top-level key and
    // matched the CURRENT key's own tail ("hould_trigger:") at index 0, so every section came back
    // one character long and every count was zero. It failed loudly because the assertion says
    // "has 0" rather than tolerating an empty section — which is the only reason it was caught.
    const count = (name, marker) => {
      const start = lines.findIndex((l) => l === `${name}:`);
      if (start === -1) return 0;
      let n = 0;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^\w/.test(lines[i])) break; // next top-level key
        // `- prompt:`/`- scenario:` open a list item; `route_to:` is a sibling key inside one,
        // so it carries no dash. Matching both shapes with one pattern is what the dash-optional
        // group is for.
        if (new RegExp(`^\\s+(- )?${marker}:`).test(lines[i])) n++;
      }
      return n;
    };

    assert.ok(
      count("should_trigger", "prompt") >= MIN_TRIGGER,
      `needs >= ${MIN_TRIGGER} should_trigger, has ${count("should_trigger", "prompt")}`,
    );
    assert.ok(
      count("should_not_trigger", "prompt") >= MIN_NOT_TRIGGER,
      `needs >= ${MIN_NOT_TRIGGER} should_not_trigger, has ${count("should_not_trigger", "prompt")}`,
    );
    assert.ok(
      count("capability", "scenario") >= MIN_CAPABILITY,
      `needs >= ${MIN_CAPABILITY} capability scenario`,
    );
    // A near-miss with no declared sibling teaches nothing: it says where the prompt should not
    // go without saying where it should.
    assert.equal(
      count("should_not_trigger", "prompt"),
      count("should_not_trigger", "route_to"),
      "every should_not_trigger needs a route_to",
    );
  });
}

test("every route_to resolves to a real resource", () => {
  const dead = [];
  for (const c of loadCases(ROOT)) {
    if (c.kind !== "negative") continue;
    assert.ok(c.routeTo, `${c.owner}: a negative case reached the audit with no route_to`);
    if (c.routeTo === "none" || c.routeTo.startsWith("external:")) continue;
    if (!RESOURCES.has(c.routeTo)) dead.push(`${c.owner} → ${c.routeTo}`);
  }
  assert.deepEqual(dead, [], `route_to names a resource that does not exist: ${dead.join(", ")}`);
});

test("a skill never routes a near-miss back to itself", () => {
  const selfRoutes = loadCases(ROOT)
    .filter((c) => c.kind === "negative" && c.routeTo === c.owner)
    .map((c) => c.owner);
  assert.deepEqual(selfRoutes, [], "a near-miss routed to the skill it was written against");
});

// ── guarding the instrument ───────────────────────────────────────────────────────────────────

test("loadCorpus reads descriptions AND triggers, not just names", () => {
  const corpus = loadCorpus(ROOT);
  assert.ok(corpus.length >= SKILLS.length + AGENTS.length, "corpus is missing resources");

  const scout = corpus.find((c) => c.id === "scout");
  assert.ok(scout, "scout missing from corpus");
  // Description text — proves the frontmatter reader works.
  assert.match(scout.text, /prior art/i, "description not loaded into the corpus");

  // Trigger text — proves the triggers parser works. This is the assertion that would have
  // caught the four-space-indent bug: without it the parser returned [] and nothing complained.
  const pm = corpus.find((c) => c.id === "praxis-memory");
  assert.match(
    pm.text,
    /accumulated project knowledge/,
    "od.triggers are not reaching the corpus — the parser is silently returning nothing",
  );
});

test("stripBoundaries removes the NOT clause and keeps the positive claim", () => {
  const d =
    "Use when curating accumulated project memory — prune stale lessons. " +
    "NOT promoting a candidate (that is `learn-graduate`), NOT the store itself (that is `praxis-memory`).";
  const out = stripBoundaries(d);
  assert.doesNotMatch(out, /\bNOT\b/, "a boundary clause survived the strip");
  assert.doesNotMatch(out, /learn-graduate|praxis-memory/, "a sibling name survived — the whole point is to not carry it");
  assert.match(out, /prune stale lessons/, "the positive claim was destroyed along with the boundary");
  // A stripper that returns its input unchanged passes every assertion above except this one.
  assert.notEqual(out, d, "stripBoundaries is a no-op");
});

test("the corpus carries both texts, and `plain` is genuinely shorter where boundaries exist", () => {
  const corpus = loadCorpus(ROOT);
  const withBoundaries = corpus.filter((c) => /\bNOT\b/.test(c.text));
  assert.ok(withBoundaries.length > 10, "almost nothing has boundary clauses — is the corpus loading descriptions?");
  for (const c of withBoundaries) {
    assert.ok(c.plain.length < c.text.length, `${c.id}: plain is not shorter, so the strip did nothing`);
    assert.doesNotMatch(c.plain, /\bNOT\b/, `${c.id}: a boundary clause reached the collision text`);
  }
  // Triggers live AFTER the description in the joined text. Stripping to end-of-string would take
  // them with it and silently shrink the collision number for the wrong reason.
  const fd = corpus.find((c) => c.id === "frontend-design");
  assert.match(fd.plain, /landing page/, "triggers were stripped along with the boundary clauses");
});

test("the positive claim stays inside its budget, and the budget is not decorative", () => {
  const r = audit(ROOT);
  assert.deepEqual(
    r.overBudget,
    [],
    `claims over ${FLOORS.maxClaimChars} chars: ${r.overBudget.map((c) => `${c.id} (${c.chars})`).join(", ")}`,
  );

  // A ceiling far above what anything writes is not a gate, it is decoration — the same failure
  // the FLOORS comment warns about for floors set too low. If the largest claim is nowhere near
  // the ceiling, someone raised the ceiling instead of shortening the description.
  const max = r.claimChars[r.claimChars.length - 1];
  assert.ok(
    max >= FLOORS.maxClaimChars * 0.8,
    `largest claim is ${max} against a ${FLOORS.maxClaimChars} ceiling — the budget stopped binding`,
  );
});

test("the collision metric is measured on the boundary-free text, not the shipped one", () => {
  // The bug this replaces: `NOT x (that is \`y\`)` injects y's vocabulary into x, so the pair the
  // doctrine works hardest to separate scores as the MOST similar. Gating that number ratchets
  // against our own descriptions. If someone reverts the metric to `text`, these diverge no more.
  const r = audit(ROOT);
  const top = r.collisions[0];
  assert.ok(top.inflated > top.score, "the raw and boundary-free readings agree — the metric is back on `text`");
  assert.ok(r.worstInflated > FLOORS.maxCollision, "the inflated reading no longer exceeds the floor; re-check the re-base");
});

test("loadCases reads every section it claims to", () => {
  const cases = loadCases(ROOT);
  const positives = cases.filter((c) => c.kind === "positive");
  const negatives = cases.filter((c) => c.kind === "negative");
  assert.ok(positives.length >= SKILLS.length * MIN_TRIGGER, `too few positives parsed: ${positives.length}`);
  assert.ok(negatives.length >= SKILLS.length * MIN_NOT_TRIGGER, `too few negatives parsed: ${negatives.length}`);
  // Every negative must have carried its route_to through the parser, not just through the lint.
  assert.equal(negatives.filter((c) => !c.routeTo).length, 0, "a route_to was dropped by the parser");
});

test("the ranker discriminates — it is not returning a flat or constant order", () => {
  const corpus = loadCorpus(ROOT);
  const ranker = buildRanker(corpus);
  const a = ranker.rank("reproduce the failing test and trace it to the root cause");
  const b = ranker.rank("build a bento grid of feature tiles with varied sizes");
  assert.notEqual(a[0].id, b[0].id, "two unrelated prompts produced the same winner");
  assert.ok(a[0].score > 0, "top result scored zero — the ranker matched nothing at all");
  assert.ok(a[0].score > a[10].score, "scores are not ordered");
});

test("the audit is armed — floors sit below the live measurement, not at zero", () => {
  const r = audit(ROOT);
  for (const k of ["rank1", "top3", "top5", "ownerAtOne", "routedTop3"]) {
    assert.ok(Number.isFinite(r[k]), `${k} is not a finite number — the metric divided by zero`);
  }
  // A floor of 0 would pass no matter what the corpus did. Each one must actually constrain.
  assert.ok(FLOORS.rank1 > 0 && FLOORS.top3 > 0 && FLOORS.routedTop3 > 0, "a recall floor is vacuous");
  assert.ok(FLOORS.maxCollision < 1, "the collision ceiling is vacuous");
  // And the live numbers must clear them, or the gate is red and someone must look.
  assert.ok(r.rank1 >= FLOORS.rank1, `rank-1 ${r.rank1.toFixed(1)}% < floor ${FLOORS.rank1}%`);
  assert.ok(r.top3 >= FLOORS.top3, `top-3 ${r.top3.toFixed(1)}% < floor ${FLOORS.top3}%`);
  assert.ok(r.routedTop3 >= FLOORS.routedTop3, `route top-3 ${r.routedTop3.toFixed(1)}% < floor ${FLOORS.routedTop3}%`);
  assert.ok(r.ownerAtOne <= FLOORS.maxOwnerAtOne, `owner-at-1 ${r.ownerAtOne.toFixed(1)}% > ${FLOORS.maxOwnerAtOne}%`);
  assert.ok(r.collisions[0].score <= FLOORS.maxCollision, `collision ${r.collisions[0].score.toFixed(2)} > ${FLOORS.maxCollision}`);
  assert.deepEqual(r.deadRoutes, [], "dead routes present");
});
