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

const LOCALES = ["lang-en-GB", "lang-fr-FR"].map((name) =>
  JSON.parse(
    readFileSync(
      new URL(`../frontend-vue/i18n/locales/${name}.json`, import.meta.url),
      "utf8",
    ),
  ),
);

test("the key panel's header is the DMS row header: the key, its place among the keys, the namespaces", () => {
  assert.match(BODY, /index: position\.value,\s+total: props\.keys\.length,/);
  assert.match(HEADER, /t\('dms_lang\.drawer\.position', \{/);
  assert.match(HEADER, /data-key-panel-crumbs/);
  assert.doesNotMatch(HEADER, /DmsEyebrow|drawer\.eyebrow/);
  for (const locale of LOCALES) {
    const position = locale.dms_lang.drawer.position;
    assert.match(position, /\{index\}.*\{total\}/);
    assert.equal(locale.dms_lang.drawer.eyebrow, undefined);
  }
});

test("the key wraps after its separators, not inside a namespace", () => {
  assert.match(HEADER, /<span>\{\{ segment \}\}<\/span>\s+<wbr \/>/);
  assert.doesNotMatch(HEADER, /break-all/);
});

test("the key panel's footer sits on the drawer's bottom edge, short key or long", () => {
  assert.match(BODY, /const fill = useScrollAreaFill\(panel\)/);
  assert.match(
    BODY,
    /<div ref="panel" class="flex flex-col gap-4" :style="fill">/,
  );
  const footer = BODY.match(/data-key-panel-footer\s+class="([^"]+)"/)?.[1];
  assert.ok(footer, "the footer is marked");
  assert.match(footer, /\bsticky\b/);
  assert.match(footer, /\bmt-auto\b/);
});

test("the key panel lays out by the drawer's width, not the window's", () => {
  for (const source of [BODY, HEADER])
    assert.doesNotMatch(source, /class="[^"]*(?<![@\w-])(sm|md|lg|xl):/);
});

test("J and K step through the keys as in a DMS row drawer, not while typing", () => {
  assert.match(PANEL, /\{ j: 'next', k: 'previous' \}/);
  assert.match(PANEL, /if \(isTypingTarget\(event\.target\)\) return/);
  assert.match(PANEL, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
  // Listening from the drawer's opening to its closing only.
  assert.match(PANEL, /state\.stopSteps = listenSteps\(context\)/);
  assert.match(PANEL, /state\.stopSteps\?\.\(\)/);
});

test("the key panel's header has the DMS drawer row header's sizes", () => {
  const title = HEADER.match(/data-key-panel-title\s+class="([^"]+)"/)?.[1];
  assert.ok(title, "the title is marked");
  // drawerRowHeader's heading: what makes the header as tall as a row drawer's.
  for (const size of [
    "text-[17px]",
    "leading-[1.3]",
    "font-[650]",
    "tracking-[-0.02em]",
  ])
    assert.ok(title.split(" ").includes(size), size);
});

test("the key panel's header stays compact: the key on two lines, the namespaces on one", () => {
  const title = HEADER.match(/data-key-panel-title\s+class="([^"]+)"/)?.[1];
  assert.match(title, /\bline-clamp-2\b/);
  const crumbs = HEADER.match(/data-key-panel-crumbs\s+class="([^"]+)"/)?.[1];
  assert.ok(crumbs, "the namespaces are marked");
  assert.match(crumbs, /\btruncate\b/);
  assert.doesNotMatch(HEADER, /flex-wrap items-baseline/);
});
