// Activation report — which Praxis resources actually fire in real sessions.
//
// Zero API cost: it reads transcripts the host already wrote. This is the
// cheapest honest answer to "which of these 34 skills earn their place", and it
// runs before any paid eval, because a skill that never activates cannot be
// measured by an experiment either.
//
//   node evals/activation/report.mjs [--transcripts <dir>] [--json]
//
// A session counts as "primed" when the SessionStart hook's framing sentence
// appears in it. Sessions without it are excluded: a skill cannot fire from a
// framework that was not loaded, and counting those would deflate every rate.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const ROOT = new URL("../..", import.meta.url).pathname;
const TRANSCRIPTS = flag("--transcripts", join(homedir(), ".claude", "projects"));
const SAVE = flag("--save", null);
const COMPARE = flag("--compare", null);
// Transcripts accumulate. A follow-up run over the whole directory would re-count
// the baseline period inside the "after" sample and dilute whatever changed, so a
// before/after needs an explicit cutoff. File mtime is the available proxy for
// when a session ran.
const SINCE = flag("--since", null);
const sinceMs = SINCE ? Date.parse(SINCE) : null;
if (SINCE && Number.isNaN(sinceMs)) { console.error(`--since: not a date: ${SINCE}`); process.exit(1); }
const PRIMED = "This environment has the Praxis framework active";

const dirNames = (d) =>
  readdirSync(join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const SKILLS = dirNames("skills");
const AGENTS = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();

function* transcripts(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* transcripts(path);
    else if (entry.name.endsWith(".jsonl")) yield path;
  }
}

const skillHits = new Map(SKILLS.map((s) => [s, 0]));
const agentHits = new Map(AGENTS.map((a) => [a, 0]));
let scanned = 0, primed = 0, primedBytes = 0;
// Priming coverage: of the sessions that actually INVOKED a Praxis resource, how
// many had the framework primed. A gap here means the hook is not firing on some
// session type — the `resume` matcher, a host that skips SessionStart — and every
// activation rate below is measured against an incomplete denominator.
let usedPraxis = 0, usedWithoutPriming = 0;

// Match the plugin-namespaced form and the bare form: a host may register a
// plugin skill either way, and counting only one would undercount silently.
const skillRe = /"skill"\s*:\s*"(?:praxis:)?([a-z0-9-]+)"/g;
const agentRe = /"subagent_type"\s*:\s*"(?:praxis:)?([a-z0-9-]+)"/g;

for (const file of transcripts(TRANSCRIPTS)) {
  if (sinceMs !== null) {
    let mtime;
    try { mtime = statSync(file).mtimeMs; } catch { continue; }
    if (mtime < sinceMs) continue;
  }
  scanned++;
  let body;
  try { body = readFileSync(file, "utf8"); } catch { continue; }
  const invoked = /"(?:skill|subagent_type)"\s*:\s*"praxis:/.test(body);
  if (invoked) usedPraxis++;
  if (!body.includes(PRIMED)) {
    if (invoked) usedWithoutPriming++;
    continue;
  }
  primed++;
  primedBytes += statSync(file).size;
  for (const [, name] of body.matchAll(skillRe)) if (skillHits.has(name)) skillHits.set(name, skillHits.get(name) + 1);
  for (const [, name] of body.matchAll(agentRe)) if (agentHits.has(name)) agentHits.set(name, agentHits.get(name) + 1);
}

const byCount = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
const silent = (m) => [...m].filter(([, n]) => n === 0).map(([k]) => k);

const snapshot = () => ({
  recorded: new Date().toISOString().slice(0, 10),
  since: SINCE ?? null,
  scanned, primed, usedPraxis, usedWithoutPriming,
  skills: Object.fromEntries(byCount(skillHits)),
  agents: Object.fromEntries(byCount(agentHits)),
});

if (args.includes("--json")) {
  console.log(JSON.stringify(snapshot(), null, 2));
  process.exit(0);
}

if (SAVE) {
  writeFileSync(SAVE, JSON.stringify(snapshot(), null, 2) + "\n");
  console.log(`\nSaved snapshot to ${SAVE}  (primed sessions: ${primed})\n`);
  process.exit(0);
}

if (COMPARE) {
  const before = JSON.parse(readFileSync(COMPARE, "utf8"));
  const now = snapshot();
  // Raw counts are not comparable across samples of different size, and the
  // priming-coverage fix changes the denominator on its own. Normalise to
  // invocations per primed session, and say so when coverage moved — otherwise a
  // hook fix reads as a routing improvement it did not cause.
  const rate = (n, snap) => (snap.primed ? n / snap.primed : 0);
  const cover = (snap) => (snap.usedPraxis ? 1 - snap.usedWithoutPriming / snap.usedPraxis : 1);

  console.log(`\n${COMPARE}  →  now${SINCE ? ` (since ${SINCE})` : ""}`);
  console.log(`primed sessions:  ${before.primed} → ${now.primed}`);
  console.log(`priming coverage: ${(cover(before) * 100).toFixed(0)}% → ${(cover(now) * 100).toFixed(0)}%` +
    (Math.abs(cover(now) - cover(before)) > 0.05
      ? `   <-- CONFOUND: coverage moved, so part of any gain below is the hook firing more often, not better routing`
      : ""));
  if (!SINCE) console.log(`NOTE: no --since, so this sample still contains the baseline period.`);

  for (const [label, key] of [["SKILLS", "skills"], ["AGENTS", "agents"]]) {
    const names = [...new Set([...Object.keys(before[key]), ...Object.keys(now[key])])];
    const rows = names
      .map((n) => ({ n, b: before[key][n] ?? 0, a: now[key][n] ?? 0 }))
      .map((r) => ({ ...r, dr: rate(r.a, now) - rate(r.b, before) }))
      .filter((r) => r.b || r.a)
      .sort((x, y) => y.dr - x.dr);
    if (!rows.length) continue;
    console.log(`\n${label}                       before   now   per-primed-session`);
    for (const r of rows) {
      const arrow = r.dr > 0.001 ? "up" : r.dr < -0.001 ? "down" : "flat";
      console.log(`  ${r.n.padEnd(28)} ${String(r.b).padStart(6)} ${String(r.a).padStart(5)}   ${rate(r.b, before).toFixed(2)} -> ${rate(r.a, now).toFixed(2)}  ${arrow}`);
    }
  }
  console.log();
  process.exit(0);
}

console.log(`\nTranscripts scanned: ${scanned}   Praxis-primed: ${primed}   (${(primedBytes / 1e6).toFixed(0)} MB)`);
console.log(`Sessions that invoked a Praxis resource: ${usedPraxis}   of those, NOT primed: ${usedWithoutPriming}` +
  (usedWithoutPriming ? `  <-- the hook did not fire here\n` : `\n`));

console.log(`AGENTS — ${total(agentHits)} dispatches across ${AGENTS.length - silent(agentHits).length}/${AGENTS.length}`);
for (const [name, n] of byCount(agentHits)) console.log(`  ${n === 0 ? "·" : n.toString().padStart(4)}  ${name}`);

console.log(`\nSKILLS — ${total(skillHits)} invocations across ${SKILLS.length - silent(skillHits).length}/${SKILLS.length}`);
for (const [name, n] of byCount(skillHits).filter(([, n]) => n > 0)) console.log(`  ${n.toString().padStart(4)}  ${name}`);

const quiet = silent(skillHits);
console.log(`\nNEVER FIRED — ${quiet.length} skills`);
for (const name of quiet) console.log(`    ·  ${name}`);
console.log();
