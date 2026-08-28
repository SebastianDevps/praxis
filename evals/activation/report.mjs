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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const ROOT = new URL("../..", import.meta.url).pathname;
const TRANSCRIPTS = flag("--transcripts", join(homedir(), ".claude", "projects"));
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

if (args.includes("--json")) {
  console.log(JSON.stringify({
    scanned, primed, usedPraxis, usedWithoutPriming, skills: Object.fromEntries(byCount(skillHits)), agents: Object.fromEntries(byCount(agentHits)),
  }, null, 2));
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
