/**
 * @packageDocumentation
 * The matrix files use the utilities the DMS build auto-imports.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as translations from "../frontend-vue/app/utils/translations.ts";
import { vue } from "./helpers/frontend-runtime.mjs";

Object.assign(globalThis, translations, { computed: vue.computed });

const { exportFileName, translationsCsv } =
  await import("../frontend-vue/app/utils/matrixExport.ts");
const {
  EMPTY_FILTERS,
  groupRows,
  parseFilter,
  targetLocales,
  useMatrixFilters,
} = await import("../frontend-vue/app/build/composables/useMatrixFilters.ts");

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

void test("translationsCsv opens as written in spreadsheets", () => {
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

void test("translationsCsv keeps cells starting with + - @ as text", () => {
  const csv = translationsCsv(
    [{ key: "k", values: { en: "+1", fr: "-2", de: "@me" } }],
    ["en", "fr", "de"],
  );
  assert.match(csv, /"'\+1","'-2","'@me"/);
});

void test("exportFileName never gives a view the whole workspace's name", () => {
  assert.equal(exportFileName("site"), "site-all.csv");
  assert.equal(exportFileName("site", ["en", "de"]), "site-view-en_de.csv");
  assert.notEqual(
    exportFileName("site", ["en", "de", "fr"]),
    exportFileName("site"),
  );
});

void test("targetLocales counts the language being translated, else every target", () => {
  assert.deepEqual(targetLocales(flat, "fr"), ["fr"]);
  assert.deepEqual(targetLocales(flat, ""), ["de", "fr"]);
  assert.deepEqual(targetLocales(flat, "it"), ["de", "fr"]);
});

void test("Every language keeps the keys missing in a hidden column", () => {
  const shop = {
    ...flat,
    rows: [
      { key: "shop.title", values: { en: "Shop", fr: "Boutique" } },
      { key: "shop.pay", values: { en: "Pay", de: "Bezahlen" } },
    ],
  };
  const { rows, counts } = useMatrixFilters(
    vue.ref(shop),
    vue.ref({ ...EMPTY_FILTERS, filter: "missing" }),
    vue.ref(new Set()),
  );
  assert.equal(counts.value.missing, 2);
  assert.deepEqual(
    rows.value.map((row) => row.key),
    ["shop.title", "shop.pay"],
  );
});

void test("groupRows counts every key of a namespace", () => {
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

void test("parseFilter falls back to all", () => {
  assert.equal(parseFilter("missing"), "missing");
  assert.equal(parseFilter("nope"), "all");
  assert.equal(parseFilter(undefined), "all");
});
