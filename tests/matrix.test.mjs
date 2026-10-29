/**
 * @packageDocumentation
 * The matrix files use the utilities the DMS build auto-imports.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as translations from "../frontend-vue/app/utils/translations.ts";

Object.assign(globalThis, translations);

const { exportFileName, translationsCsv } =
  await import("../frontend-vue/app/utils/matrixExport.ts");
const { groupRows, parseFilter, targetLocales } =
  await import("../frontend-vue/app/build/composables/useMatrixFilters.ts");

const flat = {
  defaultLocale: "en",
  locales: ["de", "en", "fr"],
  rows: [
    { key: "common.save", values: { en: "Save", fr: "Enregistrer" } },
    {
      key: "common.cancel",
      values: { en: "Cancel", de: "Abbrechen", fr: "Annuler" },
    },
    { key: "auth.title", values: { en: "Sign in" } },
  ],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 3,
};

test("translationsCsv opens as written in spreadsheets", () => {
  const csv = translationsCsv(
    [{ key: "a.b", values: { en: '=SUM(A1) "x"', fr: "Schließen\nzu" } }],
    ["en", "fr"],
  );
  assert.ok(csv.startsWith("\uFEFF"), "starts with a byte order mark");
  assert.equal(
    csv,
    '\uFEFF"key","en","fr"\r\n"a.b","\'=SUM(A1) ""x""","Schließen\nzu"\r\n',
  );
});

test("translationsCsv keeps cells starting with + - @ as text", () => {
  const csv = translationsCsv(
    [{ key: "k", values: { en: "+1", fr: "-2", de: "@me" } }],
    ["en", "fr", "de"],
  );
  assert.match(csv, /"'\+1","'-2","'@me"/);
});

test("exportFileName never gives a view the whole workspace's name", () => {
  assert.equal(exportFileName("site"), "site-all.csv");
  assert.equal(exportFileName("site", ["en", "de"]), "site-view-en_de.csv");
  assert.notEqual(
    exportFileName("site", ["en", "de", "fr"]),
    exportFileName("site"),
  );
});

test("targetLocales counts the language being translated, else the shown ones", () => {
  assert.deepEqual(targetLocales(flat, "fr", ["en", "de"]), ["fr"]);
  assert.deepEqual(targetLocales(flat, "", ["en", "fr"]), ["fr"]);
  assert.deepEqual(targetLocales(flat, "", ["en"]), ["de", "fr"]);
  assert.deepEqual(targetLocales(flat, "it", ["en", "de"]), ["de"]);
});

test("groupRows counts every key of a namespace", () => {
  const groups = groupRows(flat.rows, (row) => !row.values.de);
  assert.deepEqual(
    groups.map(({ namespace, keys, missing }) => ({
      namespace,
      keys,
      missing,
    })),
    [
      { namespace: "common", keys: 2, missing: 1 },
      { namespace: "auth", keys: 1, missing: 1 },
    ],
  );
});

test("parseFilter falls back to all", () => {
  assert.equal(parseFilter("missing"), "missing");
  assert.equal(parseFilter("nope"), "all");
  assert.equal(parseFilter(undefined), "all");
});
