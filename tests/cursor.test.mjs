// The Cursor adapter is the one host where crafts cannot arrive through a hook:
// `subagentStart` and `beforeSubmitPrompt` return `user_message`, which is
// display-only text shown when a prompt is blocked or a subagent denied, and
// never reaches the model. Only `sessionStart` carries `additional_context`.
// So the generated rule files ARE the mechanism there — and a stale generated
// file is a silent divergence between what Cursor enforces and what the craft says.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { craftNames, expectedRule, rulePath } from "../scripts/build-cursor-crafts.mjs";

for (const name of craftNames()) {
  test(`.cursor/rules/craft-${name}.mdc is present and current`, () => {
    const path = rulePath(name);
    assert.ok(existsSync(path), `missing — run: node scripts/build-cursor-crafts.mjs`);
    assert.equal(
      readFileSync(path, "utf8"),
      expectedRule(name),
      `stale — run: node scripts/build-cursor-crafts.mjs`,
    );
  });
}

test("every craft has an explicit Cursor scope", () => {
  // renderCraftRule throws for an unscoped craft, so adding a craft without
  // deciding where it applies fails here rather than shipping unscoped.
  for (const name of craftNames()) assert.doesNotThrow(() => expectedRule(name));
});
