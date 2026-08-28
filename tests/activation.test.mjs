// The activation report is an instrument we act on — it already moved a design
// decision and exposed the resume-matcher gap — so it needs the same treatment
// as the code it measures. Fixtures are synthesised per test, not committed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const REPORT = join(ROOT, "evals", "activation", "report.mjs");
const PRIMED = "This environment has the Praxis framework active";

const run = (args) =>
  execFileSync("node", [REPORT, ...args], { encoding: "utf8", timeout: 20_000 });

// A transcript with one human turn, optionally primed, optionally invoking things.
function transcript({ primed = true, skills = [], agents = [] }) {
  const rows = [];
  if (primed) rows.push(JSON.stringify({ type: "system", content: PRIMED }));
  for (const s of skills) rows.push(JSON.stringify({ type: "assistant", input: { skill: `praxis:${s}` } }));
  for (const a of agents) rows.push(JSON.stringify({ type: "assistant", input: { subagent_type: `praxis:${a}` } }));
  return rows.join("\n") + "\n";
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "praxis-activation-"));
  mkdirSync(join(dir, "proj"), { recursive: true });
  for (const [name, { body, mtime }] of Object.entries(files)) {
    const path = join(dir, "proj", name);
    writeFileSync(path, body);
    if (mtime) utimesSync(path, new Date(mtime), new Date(mtime));
  }
  return dir;
}

test("counts only primed sessions, and reports the priming gap separately", () => {
  const dir = fixture({
    "a.jsonl": { body: transcript({ primed: true, skills: ["scout"], agents: ["engineer"] }) },
    "b.jsonl": { body: transcript({ primed: false, skills: ["scout"] }) },
  });
  const out = JSON.parse(run(["--transcripts", dir, "--json"]));
  assert.equal(out.primed, 1, "the unprimed session must not count toward rates");
  assert.equal(out.skills.scout, 1, "only the primed session's invocation is counted");
  assert.equal(out.agents.engineer, 1);
  assert.equal(out.usedPraxis, 2, "both sessions invoked something");
  assert.equal(out.usedWithoutPriming, 1, "and one of them ran unprimed");
});

test("--since excludes sessions before the cutoff", () => {
  const dir = fixture({
    "old.jsonl": { body: transcript({ skills: ["scout"] }), mtime: "2026-01-01T00:00:00Z" },
    "new.jsonl": { body: transcript({ skills: ["docs-seeker"] }), mtime: "2026-08-01T00:00:00Z" },
  });
  const all = JSON.parse(run(["--transcripts", dir, "--json"]));
  assert.equal(all.primed, 2);

  const recent = JSON.parse(run(["--transcripts", dir, "--since", "2026-06-01", "--json"]));
  assert.equal(recent.primed, 1, "the cutoff must drop the older sample");
  assert.equal(recent.skills.scout, 0);
  assert.equal(recent.skills["docs-seeker"], 1);
});

test("an unparseable --since fails loudly instead of silently scanning everything", () => {
  assert.throws(() => run(["--since", "not-a-date", "--json"]), /not a date|Command failed/);
});

test("--save then --compare reports a real delta, normalised per primed session", () => {
  const before = fixture({ "a.jsonl": { body: transcript({ skills: ["scout"] }) } });
  const snap = join(mkdtempSync(join(tmpdir(), "praxis-snap-")), "baseline.json");
  run(["--transcripts", before, "--save", snap]);
  assert.equal(JSON.parse(readFileSync(snap, "utf8")).skills.scout, 1);

  // Twice the sessions and four times the invocations: the raw count doubles per
  // session, so a comparison that only read totals would overstate the change.
  const after = fixture({
    "a.jsonl": { body: transcript({ skills: ["scout", "scout"] }) },
    "b.jsonl": { body: transcript({ skills: ["scout", "scout"] }) },
  });
  const out = run(["--transcripts", after, "--compare", snap]);
  assert.match(out, /primed sessions:\s+1 → 2/);
  assert.match(out, /scout\s+1\s+4\s+1\.00 -> 2\.00\s+up/);
});

test("--compare warns when priming coverage moved, and when no cutoff was given", () => {
  const before = fixture({
    "a.jsonl": { body: transcript({ primed: false, skills: ["scout"] }) },
    "b.jsonl": { body: transcript({ primed: true, skills: ["scout"] }) },
  });
  const snap = join(mkdtempSync(join(tmpdir(), "praxis-snap-")), "baseline.json");
  run(["--transcripts", before, "--save", snap]);

  const after = fixture({ "a.jsonl": { body: transcript({ primed: true, skills: ["scout"] }) } });
  const out = run(["--transcripts", after, "--compare", snap]);
  assert.match(out, /CONFOUND/, "a coverage jump must be flagged, not silently read as better routing");
  assert.match(out, /no --since/, "an overlapping sample must be called out");
});

// An empty "after" sample is the normal state right after a change lands, and the
// first version of this comparison handled it badly: coverage fell back to 1 and
// printed a fake 100% with a CONFOUND warning, while every resource read "down"
// from dividing by zero — a regression report for a change nobody had used yet.
test("--compare against an empty sample says so instead of reporting a collapse", () => {
  const before = fixture({ "a.jsonl": { body: transcript({ skills: ["scout"] }), mtime: "2026-01-01T00:00:00Z" } });
  const snap = join(mkdtempSync(join(tmpdir(), "praxis-snap-")), "baseline.json");
  run(["--transcripts", before, "--save", snap]);

  const out = run(["--transcripts", before, "--since", "2026-06-01", "--compare", snap]);
  assert.match(out, /primed sessions:\s+1 → 0/);
  assert.match(out, /nothing to compare yet/);
  assert.doesNotMatch(out, /CONFOUND/, "no data cannot be a confound");
  assert.doesNotMatch(out, /down/, "no data is not a regression");
  assert.doesNotMatch(out, /100%/, "coverage over an empty sample is unknown, not perfect");
});

// Primed but unused is the common case, not an edge one: Praxis loads in every
// session and most of them never invoke a resource. Coverage is undefined there —
// there is nothing whose priming could have succeeded or failed — and reporting it
// as 100% would manufacture a jump against a baseline that had a real gap.
test("coverage is unknown, not perfect, when nothing was invoked", () => {
  const before = fixture({
    "a.jsonl": { body: transcript({ primed: false, skills: ["scout"] }) },
    "b.jsonl": { body: transcript({ primed: true, skills: ["scout"] }) },
  });
  const snap = join(mkdtempSync(join(tmpdir(), "praxis-snap-")), "baseline.json");
  run(["--transcripts", before, "--save", snap]);

  // Primed, but invoking nothing.
  const after = fixture({ "a.jsonl": { body: transcript({ primed: true }) } });
  const out = run(["--transcripts", after, "--compare", snap]);
  assert.match(out, /priming coverage:\s+50% → n\/a/);
  assert.doesNotMatch(out, /CONFOUND/, "an unknown cannot be compared against a number");
});
