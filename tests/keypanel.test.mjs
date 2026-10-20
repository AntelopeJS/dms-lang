import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The key panel is a DMS drawer opened from a composable that renders Vue
// components: what it must keep doing is read from its sources.

const read = (path) =>
  readFileSync(
    new URL(`../frontend-vue/app/build/${path}`, import.meta.url),
    "utf8",
  );
const PANEL = read("composables/useKeyPanel.ts");
const BODY = read("components/KeyEditorDrawer.vue");
const HEADER = read("components/KeyEditorHeader.vue");

test("the key panel keeps the width it is given under one id", () => {
  // The DMS remembers a drawer's width under its `sizeKey`, which defaults
  // to its `containerId`.
  const id = PANEL.match(/const DRAWER_ID = '([\w-]+)'/)?.[1];
  assert.ok(id, "a stable drawer id is declared");
  assert.match(PANEL, /containerId: DRAWER_ID,/);
});

test("closing the key panel does not go Back, which renders the page anew", () => {
  assert.doesNotMatch(PANEL, /router\.back\(/);
  assert.match(PANEL, /router\.replace\(linkWithKey\(context, undefined\)\)/);
});

test("every language field of the key panel is labelled by its name", () => {
  assert.match(
    BODY,
    /<label\s+v-if="props\.editable"\s+:for="fieldIdOf\(code\)"/,
  );
  assert.match(
    BODY,
    /<UTextarea\s+v-if="props\.editable"\s+:id="fieldIdOf\(code\)"/,
  );
});

test("the key is announced as the drawer's title only, not as a second heading", () => {
  assert.doesNotMatch(HEADER, /<h[1-6][\s>]/);
});
