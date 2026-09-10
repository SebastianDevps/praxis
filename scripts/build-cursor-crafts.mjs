// Generate one Cursor rule file per craft.
//
// Cursor cannot receive crafts the way Claude Code and Codex do: its
// `subagentStart` and `beforeSubmitPrompt` hooks return `user_message`, which is
// display-only text shown when a prompt is blocked or a subagent denied — it
// never reaches the model. Only `sessionStart` carries `additional_context`.
// So on Cursor the always-apply rule file IS the injection mechanism.
//
// These files are GENERATED. Edit crafts/, then rerun:
//   node scripts/build-cursor-crafts.mjs
// tests/cursor.test.mjs fails if they are stale.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, ".cursor", "rules");

// Which crafts apply everywhere vs. only to the files they govern. Scoping the
// visual crafts keeps a backend-only turn from carrying design rules it cannot use.
const WEB_GLOBS = "**/*.tsx,**/*.jsx,**/*.ts,**/*.js,**/*.css,**/*.html,**/*.vue,**/*.svelte,**/*.astro";
const SCOPE = {
  minimalism: { alwaysApply: true },
  orchestration: { alwaysApply: true },
  "evidence-discipline": { alwaysApply: true },
  "anti-slop": { globs: WEB_GLOBS },
  "a11y-baseline": { globs: WEB_GLOBS },
  "motion-discipline": { globs: WEB_GLOBS },
};

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? m[1] : "";
}
function body(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "").trim();
}
function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

export function renderCraftRule(name, source) {
  const fm = frontmatter(source);
  const scope = SCOPE[name];
  if (!scope) throw new Error(`craft "${name}" has no Cursor scope — add it to SCOPE in scripts/build-cursor-crafts.mjs`);
  const header = scope.alwaysApply
    ? `alwaysApply: true`
    : `globs: ${scope.globs}\nalwaysApply: false`;
  return `---
description: "Praxis craft — ${field(fm, "description")}"
${header}
---

<!-- GENERATED from crafts/${name}/${name}.md by scripts/build-cursor-crafts.mjs. Do not edit. -->

# Craft — ${name}

${body(source)}
`;
}

export function craftNames() {
  return readdirSync(join(ROOT, "crafts"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function expectedRule(name) {
  return renderCraftRule(name, readFileSync(join(ROOT, "crafts", name, `${name}.md`), "utf8"));
}

export const rulePath = (name) => join(OUT, `craft-${name}.mdc`);

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of craftNames()) {
    writeFileSync(rulePath(name), expectedRule(name));
    console.log(`wrote .cursor/rules/craft-${name}.mdc`);
  }
}
