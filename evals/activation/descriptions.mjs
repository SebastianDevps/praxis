// Description audit — separate "never needed" from "needed and never matched".
//
// The activation report says a skill is silent. Silence has two causes it cannot
// tell apart: the task never arose, or the task arose and the description failed
// to route. Only the second is a bug, and only the second is worth fixing.
//
// This cross-references each skill's curated `od.triggers` against the real user
// prompts in primed sessions. A skill whose triggers appear in prompts but which
// never fired is a routing failure. A skill whose triggers never appear was
// simply never needed here.
//
//   node evals/activation/descriptions.mjs [--transcripts DIR] [--show <skill>]
//
// HEURISTIC, NOT PROOF. Keyword overlap is not intent: a one-word trigger like
// "security" or "bug" over-matches, so single-word triggers are marked low
// precision and every count can be inspected with --show before it is believed.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const ROOT = new URL("../..", import.meta.url).pathname;
const TRANSCRIPTS = flag("--transcripts", join(homedir(), ".claude", "projects"));
const SHOW = flag("--show", null);
const PRIMED = "This environment has the Praxis framework active";

// od.triggers appears in both YAML shapes: a block list and a flow list.
function triggersOf(skill) {
  const text = readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const after = fm.split(/^\s*triggers:/m)[1];
  if (!after) return [];
  const flow = after.match(/^\s*\[(.*?)\]/s);
  const raw = flow
    ? flow[1].split(",")
    : after.split("\n").slice(1).reduce((acc, line) => {
        const m = line.match(/^\s*-\s+(.*)$/);
        if (m) acc.push(m[1]);
        else if (acc.length && line.trim() && !/^\s{0,2}\S/.test(line)) acc.push(line);
        else if (acc.length) return (acc.done = true, acc);
        return acc;
      }, []);
  return raw
    .map((t) => t.trim().replace(/^["']|["'],?$/g, "").trim().toLowerCase())
    .filter((t) => t && !t.includes(":"));
}

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

// Only genuine human turns. Tool results, system reminders, hook-injected
// context and command expansions are not the user asking for something, and
// counting them would let Praxis's own injected text match its own triggers.
function userPrompts(body) {
  const out = [];
  for (const line of body.split("\n")) {
    if (!line.startsWith('{"parentUuid"') && !line.includes('"type":"user"')) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.type !== "user" || row.isMeta) continue;
    const content = row.message?.content;
    const parts = typeof content === "string" ? [content]
      : Array.isArray(content) ? content.filter((c) => c.type === "text").map((c) => c.text) : [];
    for (const text of parts) {
      if (!text || text.includes("<system-reminder>") || text.includes(PRIMED)) continue;
      if (text.startsWith("<") || text.startsWith("Caveat:")) continue;
      // Compaction summaries are the model restating the session, not the human
      // asking for anything. They also quote the whole conversation, so every
      // trigger in it matches — they inflated the first run's counts badly.
      if (text.includes("This session is being continued from a previous conversation")) continue;
      if (text.startsWith("Analysis:") || text.startsWith("Summary:")) continue;
      out.push(text.toLowerCase());
    }
  }
  return out;
}

const SKILLS = readdirSync(join(ROOT, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();

// Substring matching is wrong for this: "ad" matched "ciudad", "recon" matched
// "reconcile", "auth" matched "author", "spec" matched "especificación". Word
// boundaries only, and Unicode-aware so accented Spanish words are not split.
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const asRegex = (t) => new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(t)}([^\\p{L}\\p{N}_]|$)`, "u");
const triggers = new Map(SKILLS.map((s) => [s, triggersOf(s).map((t) => ({ t, re: asRegex(t) }))]));
const hits = new Map(SKILLS.map((s) => [s, 0]));
const samples = new Map(SKILLS.map((s) => [s, []]));
const invoked = new Map(SKILLS.map((s) => [s, 0]));
const skillRe = /"skill"\s*:\s*"(?:praxis:)?([a-z0-9-]+)"/g;
let prompts = 0, primed = 0;

for (const file of files(TRANSCRIPTS)) {
  let body;
  try { body = readFileSync(file, "utf8"); } catch { continue; }
  if (!body.includes(PRIMED)) continue;
  primed++;
  for (const [, name] of body.matchAll(skillRe)) if (invoked.has(name)) invoked.set(name, invoked.get(name) + 1);
  for (const prompt of userPrompts(body)) {
    prompts++;
    for (const skill of SKILLS) {
      const hit = triggers.get(skill).find(({ re }) => re.test(prompt));
      if (!hit) continue;
      const t = hit.t;
      hits.set(skill, hits.get(skill) + 1);
      if (samples.get(skill).length < 5) samples.get(skill).push({ t, prompt: prompt.slice(0, 110).replace(/\s+/g, " ") });
    }
  }
}

if (SHOW) {
  console.log(`\n${SHOW} — triggers: ${triggers.get(SHOW)?.map((x) => x.t).join(" · ") ?? "(none)"}\n`);
  for (const s of samples.get(SHOW) ?? []) console.log(`  [${s.t}]  ${s.prompt}`);
  console.log();
  process.exit(0);
}

const lowPrecision = (s) => triggers.get(s).some(({ t }) => !t.includes(" "));
const verdict = (s) => {
  const h = hits.get(s), i = invoked.get(s);
  if (i > 0) return "fired";
  if (h === 0) return "never needed here";
  return "ROUTING GAP";
};

console.log(`\nPrimed sessions: ${primed}   Human prompts: ${prompts}\n`);
console.log("skill                          prompts  fired  verdict");
console.log("-".repeat(72));
for (const s of SKILLS.sort((a, b) => hits.get(b) - hits.get(a) || a.localeCompare(b))) {
  const v = verdict(s);
  console.log(
    `${s.padEnd(30)} ${String(hits.get(s)).padStart(6)} ${String(invoked.get(s)).padStart(6)}  ${v}` +
    (v === "ROUTING GAP" && lowPrecision(s) ? "  (low precision — inspect with --show)" : ""),
  );
}
console.log();
