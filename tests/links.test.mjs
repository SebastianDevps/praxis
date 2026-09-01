// Do the paths Praxis points at actually exist?
//
// Every resource here is prose that tells an agent where to look next. A link that no longer
// resolves sends it nowhere, and nothing checked any of them: `validate-resources.mjs` reads
// frontmatter, `references.test.mjs` reads routing tables, and the body text — where most of the
// pointers live — was unchecked.
//
// THE ONE IDEA THAT MAKES THIS USABLE: **code shows, prose points.**
//
// A path inside a fenced block or an inline-code span is being DISPLAYED as syntax — a directory
// tree, an example command, a template someone will fill in. A path in prose is being OFFERED to
// follow. Only the second is a promise. That distinction already exists in the markup, so it needs
// no annotations to author and no allowlist to maintain.
//
// Without it this check reports every `.praxis/memory/` in every example tree as a broken link,
// which is how a gate earns the right to be ignored.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DIRS = ["agents", "skills", "crafts", "pipelines", "commands", "docs"];

// The root documents were outside this gate entirely — README.md most of all, which is the
// one file a stranger evaluating this project actually opens. Listed explicitly rather than
// walked: the repo root also holds node_modules, evals and .git, and none of that is prose.
const ROOT_DOCS = ["README.md", "CHANGELOG.md", "AGENTS.md", "GEMINI.md"];

function docs() {
  const files = DIRS.flatMap((d) => walk(join(ROOT, d)));
  return files.concat(ROOT_DOCS.map((f) => join(ROOT, f)).filter((p) => existsSync(p)));
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Line-scanned rather than regexed across the file: an UNTERMINATED fence must swallow the rest of
// the document, which a paired regex quietly declines to do — leaving example links in a half-open
// block looking like prose.
export function stripFences(text) {
  const out = [];
  let fence = null;
  for (const line of text.split("\n")) {
    const m = /^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (m) {
      if (fence === null) fence = m[2][0];
      else if (m[2][0] === fence && !m[3].trim()) fence = null;
      out.push("");
      continue;
    }
    out.push(fence === null ? line : "");
  }
  return out.join("\n");
}

// Blank out inline-code spans, preserving length so nothing else shifts.
export function stripInlineCode(text) {
  return text.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

// Markdown links in prose only. Anchors, URLs and mailto are not filesystem claims.
export function proseLinks(text) {
  const prose = stripInlineCode(stripFences(text));
  const out = [];
  for (const m of prose.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    out.push(target.split("#")[0]);
  }
  return out.filter(Boolean);
}

// Same-document anchors were skipped above as "not filesystem claims" — true, and it left
// them checked by nothing. A heading reworded a year from now silently breaks the link, and
// the reader who notices is the one deciding whether to trust the project.
// GitHub's slug rule: lowercase, drop punctuation that is not word/space/hyphen, spaces to
// hyphens. Duplicate headings get a -1 suffix, which nothing here relies on.
export function headingSlugs(text) {
  const prose = stripFences(text);
  return new Set(
    [...prose.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)].map(([, h]) =>
      h.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
    ),
  );
}

export function localAnchors(text) {
  const prose = stripInlineCode(stripFences(text));
  return [...prose.matchAll(/\[[^\]\n]*\]\(#([^)\s]+)\)/g)].map((m) => m[1]);
}

test("every same-document anchor points at a heading that exists", () => {
  const broken = [];
  for (const file of docs()) {
    const text = readFileSync(file, "utf8");
    const slugs = headingSlugs(text);
    for (const anchor of localAnchors(text)) {
      if (!slugs.has(anchor)) broken.push(`${relative(ROOT, file)} → #${anchor}`);
    }
  }
  assert.deepEqual(broken, [], `broken anchors:\n${broken.join("\n")}`);
});

test("every path linked from prose resolves", () => {
  const broken = [];
  {
    for (const file of docs()) {
      for (const target of proseLinks(readFileSync(file, "utf8"))) {
        // Resolved relative to the document, exactly as a markdown reader would.
        const abs = resolve(dirname(file), target);
        if (!abs.startsWith(ROOT)) {
          broken.push(`${relative(ROOT, file)} → ${target} (escapes the repo)`);
          continue;
        }
        if (!existsSync(abs)) broken.push(`${relative(ROOT, file)} → ${target}`);
      }
    }
  }
  assert.deepEqual(broken, [], `unresolved prose links:\n  ${broken.join("\n  ")}`);
});

// The extractor is the load-bearing half: if it silently returned nothing, the test above would
// pass on a repo full of dead links and nobody would know. These assert it still discriminates.
test("the extractor tells prose from code", () => {
  const doc = [
    "See [the router](skills/using-praxis/SKILL.md) for details.",
    "",
    "```",
    "[not a link](does/not/exist.md)",
    "```",
    "",
    "Inline `[also not](nope.md)` stays out.",
    "",
    "And [an anchor](#section) plus [a url](https://example.com) are not paths.",
  ].join("\n");

  assert.deepEqual(proseLinks(doc), ["skills/using-praxis/SKILL.md"]);
});

test("an unterminated fence swallows the rest of the file", () => {
  const doc = ["```", "[inside](ghost.md)", "", "[still inside](ghost2.md)"].join("\n");
  assert.deepEqual(proseLinks(doc), [], "a half-open fence leaked example links into prose");
});

test("a directory link resolves to a directory", () => {
  // Guards the reverse mistake: existsSync is true for a directory, so a link that means to point
  // at a file but names its folder would pass silently.
  const dirLinks = [];
  for (const dir of DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      for (const target of proseLinks(readFileSync(file, "utf8"))) {
        const abs = resolve(dirname(file), target);
        if (!existsSync(abs)) continue;
        if (statSync(abs).isDirectory() && !target.endsWith("/"))
          dirLinks.push(`${relative(ROOT, file)} → ${target}`);
      }
    }
  }
  assert.deepEqual(dirLinks, [], `link points at a directory without a trailing slash:\n  ${dirLinks.join("\n  ")}`);
});
