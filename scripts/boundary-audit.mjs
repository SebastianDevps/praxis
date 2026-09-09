// boundary-audit.mjs — does a skill's BODY do the job its own DESCRIPTION excludes?
//
// The doctrine gives every skill a boundary clause: "NOT <x> (that is `sibling`)". Nothing checked
// that the body honoured it. `scout` declared "NOT multi-source external investigation (that is
// `deep-research`)" and carried a section headed "**External — what's already been solved**". A
// live run followed the description and skipped the section, so the skill delivered half of what
// it promised and no counter anywhere showed it.
//
// WHAT IT IS: a literal-word clash between the excluded phrase and a section label. Deliberately
// narrow. An earlier attempt ranked each body section against the corpus and asked whether the
// excluded sibling outranked the owner; it produced 24 candidates of which 4 were read and 4 were
// false — a lexical ranker cannot tell "does the sibling's job" from "talks about the sibling's
// topic", which routing-audit.mjs already warns about in its own terms. This version trades that
// recall for precision it can defend.
//
// VALIDATED against the known positive: run against the pre-fix scout it reports the clash and the
// total is 10; against the repaired tree, 9. A detector that cannot catch the case it was written
// for is decoration, and this one was decoration until section labels included bold lines — the
// clash lived in "**External — …**", not in a `##` heading.
//
// KNOWN LIMIT: it sees a shared word, not a shared job. All 9 of today's hits were read and all 9
// are benign — "Brand Safety" is not defining a brand, WCAG ratios are not auditing a page. They
// are the baseline in tests/boundary.test.mjs, and the gate fails on a tenth, not on these.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Generic words carry no discriminative signal: every skill body says "before", "when", "plan".
const STOP = new Set(("the a an of to in for that is are and or not with what who your you this it its on already "
  + "before after when where while into from still even any all one two "
  + "plan skill skills use uses using run runs make makes write writes work works thing things "
  + "something anything first then also only just have has been").split(" "));

const fm = (t) => t.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
const description = (t) => (fm(t).match(/description:\s*([\s\S]*?)(?:\n[a-z_]+:|$)/)?.[1] ?? "").trim();
const words = (s) => (s.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !STOP.has(w));

// Section LABELS, not just markdown headings. scout's clash lived in "**External — …**", a bold
// list label; a heading-only scan missed the one case this was written for.
const labels = (t) => t.replace(/^---[\s\S]*?\n---\n/, "").split("\n")
  .filter((l) => /^#{2,3}\s/.test(l) || /^\s*[-*]?\s*\*\*[^*]+\*\*/.test(l));

export function boundaryClashes(root = DEFAULT_ROOT) {
  const out = [];
  for (const id of readdirSync(join(root, "skills")).sort()) {
    const file = join(root, "skills", id, "SKILL.md");
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const [, excluded, sibling] of description(text).matchAll(/NOT\s+([^(]+?)\s*\(that is\s*`([a-z0-9-]+)`\)/gi)) {
      const ex = new Set(words(excluded));
      for (const label of labels(text)) {
        const hit = words(label).find((w) => ex.has(w));
        if (!hit) continue;
        // A label that REFERENCES the sibling is handing off — the doctrine working, not a clash.
        // Backticks are required: a bare-word match filtered "Brand Safety" as a hand-off to
        // `brand`, which is a different word doing a different job. Right answer, wrong mechanism.
        if (new RegExp("`" + sibling + "`").test(label)) continue;
        out.push({ id, sibling, excluded: excluded.trim(), label: label.replace(/^#+\s*/, "").trim(), hit });
      }
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = boundaryClashes(process.argv[2] || DEFAULT_ROOT);
  for (const f of found) {
    console.log(`  ${f.id}`);
    console.log(`    description excludes: "${f.excluded}" -> \`${f.sibling}\``);
    console.log(`    body label:           "${f.label.slice(0, 96)}"   (shared word: "${f.hit}")\n`);
  }
  console.log(`boundary clashes: ${found.length}`);
}
