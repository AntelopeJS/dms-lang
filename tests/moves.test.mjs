import assert from "node:assert/strict";
import { test } from "node:test";
import * as translations from "../frontend-vue/app/utils/translations.ts";

Object.assign(globalThis, translations);

const { useCellMoves } =
  await import("../frontend-vue/app/build/composables/useCellMoves.ts");

function ref(value) {
  return { value };
}

const rows = [
  { key: "a.one", values: { en: "One", fr: "Un" } },
  { key: "a.two", values: { en: "Two" } },
  { key: "b.three", values: { en: "Three" } },
];

function movesOf({ pending = [] } = {}) {
  const view = {
    renderedRows: ref(rows),
    hasMore: ref(false),
    showMore: () => undefined,
  };
  return useCellMoves({
    view,
    groups: ref([
      { namespace: "a", keys: 2, missing: 1, rows: rows.slice(0, 2) },
      { namespace: "b", keys: 1, missing: 1, rows: rows.slice(2) },
    ]),
    columnCodes: ref(["en", "fr", "de"]),
    targets: ref(["fr", "de"]),
    baseLocale: () => "en",
    isPending: (key, code) => pending.includes(`${key}:${code}`),
  });
}

test("Tab walks the target languages, then the next row", () => {
  const moves = movesOf();
  assert.deepEqual(moves.targetOf({ key: "a.one", code: "fr" }, "next"), {
    key: "a.one",
    code: "de",
  });
  assert.deepEqual(moves.targetOf({ key: "a.one", code: "de" }, "next"), {
    key: "a.two",
    code: "fr",
  });
  assert.deepEqual(moves.targetOf({ key: "a.two", code: "fr" }, "previous"), {
    key: "a.one",
    code: "de",
  });
});

test("Tab and Enter on the last cell have no cell to go to", () => {
  const moves = movesOf();
  assert.equal(moves.targetOf({ key: "b.three", code: "de" }, "next"), null);
  assert.equal(moves.targetOf({ key: "b.three", code: "fr" }, "down"), null);
  assert.equal(moves.targetOf({ key: "a.one", code: "fr" }, "stay"), null);
});

test("N goes to the next empty cell, skipping texts being saved", () => {
  const moves = movesOf({ pending: ["a.one:de"] });
  assert.deepEqual(moves.nextMissing(null, 1), { key: "a.two", code: "fr" });
  assert.deepEqual(moves.nextMissing({ key: "a.two", code: "de" }, 1), {
    key: "b.three",
    code: "fr",
  });
  assert.deepEqual(moves.nextMissing({ key: "a.two", code: "fr" }, -1), {
    key: "b.three",
    code: "de",
  });
});
