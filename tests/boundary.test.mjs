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
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boundaryClashes } from "../scripts/boundary-audit.mjs";

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
