// Dependency-free resource validator for Praxis.
// Pure Node stdlib — no pnpm, no TypeScript build, no js-yaml.
// Checks each agent/skill/craft/pipeline .md for valid frontmatter:
//   - starts with a --- frontmatter block
//   - name: present + kebab-case
//   - description: present + non-empty
//   - kind: one of skill | agent | craft | pipeline
//   - pipeline: has a phases: list
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIRS = ["agents", "skills", "pipelines", "crafts"];
const VALID_KINDS = new Set(["skill", "agent", "craft", "pipeline"]);
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function walkMarkdown(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    // `references/` holds supporting docs (e.g. per-host tool maps), not
    // resources — they have no resource frontmatter, so skip the whole dir.
    if (entry === "references") continue;
    if (statSync(full).isDirectory()) results.push(...walkMarkdown(full));
    else if (entry.endsWith(".md")) results.push(full);
  }
  return results;
}

// Read a top-level scalar key (no indentation) from the frontmatter block.
function topLevelValue(frontmatter, key) {
  const re = new RegExp(`^${key}:[ \\t]*(.*)$`, "m");
  const m = re.exec(frontmatter);
  if (m === null) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// Detect a top-level list key (`phases:` followed by `- ...` items or an inline [..]).
function hasTopLevelList(frontmatter, key) {
  const re = new RegExp(`^${key}:[ \\t]*(\\[.*\\]|)[ \\t]*$`, "m");
  const m = re.exec(frontmatter);
  if (m === null) return false;
  if (m[1].trim().startsWith("[")) return m[1].trim().length > 2; // inline non-empty array
  // block form: next non-empty line must be an indented "- " item
  const after = frontmatter.slice(m.index + m[0].length);
  return /^\s*-\s+\S/m.test(after.split(/\n(?=\S)/)[0] ?? after);
}

function validate(content) {
  const match = FRONTMATTER_RE.exec(content);
  if (match === null) throw new Error("missing frontmatter: file must start with ---");
  const fm = match[1] ?? "";

  const name = topLevelValue(fm, "name");
  if (!name) throw new Error("missing required field: name");
  if (!KEBAB_CASE_RE.test(name)) throw new Error(`name must be kebab-case, got: "${name}"`);

  const description = topLevelValue(fm, "description");
  if (!description) throw new Error("missing required field: description");

  const kind = topLevelValue(fm, "kind");
  if (!kind || !VALID_KINDS.has(kind))
    throw new Error(`invalid or missing kind: "${kind}"; must be skill, agent, craft, or pipeline`);

  if (kind === "pipeline" && !hasTopLevelList(fm, "phases"))
    throw new Error("pipeline requires a phases field containing a non-empty list");
}

let pass = 0;
let fail = 0;
for (const dir of DIRS) {
  for (const file of walkMarkdown(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length + 1);
    try {
      validate(readFileSync(file, "utf8"));
      console.log(`PASS  ${rel}`);
      pass++;
    } catch (err) {
      console.error(`FAIL  ${rel}: ${err.message}`);
      fail++;
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
