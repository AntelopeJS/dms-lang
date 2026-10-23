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

test("the key panel keeps the width it is given under one id", () => {
  // The DMS remembers a drawer's width under its `sizeKey`.
  const id = PANEL.match(/const DRAWER_ID = '([\w-]+)'/)?.[1];
  assert.ok(id, "a stable drawer id is declared");
  assert.match(PANEL, /sizeKey: DRAWER_ID,/);
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

const LOCALES = ["lang-en-GB", "lang-fr-FR"].map((name) =>
  JSON.parse(
    readFileSync(
      new URL(`../frontend-vue/i18n/locales/${name}.json`, import.meta.url),
      "utf8",
    ),
  ),
);

test("the key panel's header is the DMS row header: the key, its place among the keys", () => {
  assert.match(BODY, /index: position\.value,\s+total: props\.keys\.length,/);
  assert.match(PANEL, /rowHeader: rowHeaderOf\(header\)/);
  assert.match(PANEL, /positionLabel: POSITION_LABEL,/);
  assert.match(PANEL, /const POSITION_LABEL = '\$dms_lang\.drawer\.position'/);
  assert.doesNotMatch(PANEL, /headerComponent/);
  for (const locale of LOCALES) {
    const position = locale.dms_lang.drawer.position;
    assert.match(position, /\{index\}.*\{total\}/);
    assert.equal(locale.dms_lang.drawer.eyebrow, undefined);
  }
});

test("the key panel's footer is the DMS footer, its body filling the drawer", () => {
  assert.match(BODY, /<div class="flex flex-1 flex-col gap-4">/);
  assert.match(BODY, /<DmsContainerFooter data-key-panel-footer>/);
  assert.doesNotMatch(BODY, /dms-form-foot|useScrollAreaFill|minHeight/);
});

test("the key panel lays out by the drawer's width, not the window's", () => {
  assert.doesNotMatch(BODY, /class="[^"]*(?<![@\w-])(sm|md|lg|xl):/);
});

test("J and K are the DMS row header's, not the panel's own", () => {
  assert.doesNotMatch(PANEL, /addEventListener\('keydown'/);
  assert.match(PANEL, /navigation: \{/);
});

test("the row header keeps the key's look: mono, wrapped after its separators, its namespaces and status", () => {
  assert.match(PANEL, /titleClass: 'font-mono',/);
  assert.match(PANEL, /titleBreakAfter: NAMESPACE_SEPARATOR,/);
  assert.match(PANEL, /subtitle: header\.crumbs \|\| undefined,/);
  assert.match(PANEL, /subtitleClass: 'font-mono',/);
  assert.match(PANEL, /component: KeyStatus,/);
  // The opening header already has the key's look: no flash of another font.
  assert.match(PANEL, /rowHeader: openingRowHeader\(request\.key\)/);
});
