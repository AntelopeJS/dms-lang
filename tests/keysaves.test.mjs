import assert from "node:assert/strict";
import { test } from "node:test";
import * as translations from "../frontend-vue/app/utils/translations.ts";
import * as mutations from "../frontend-vue/app/composables/translation/useMutationToast.ts";

Object.assign(globalThis, translations, mutations);

const {
  carriedExpected,
  saveIdOf,
  saveIdPrefix,
  savedText,
  storedText,
  withEntry,
} = await import("../frontend-vue/app/utils/keySaves.ts");
const { keySaveFailure } =
  await import("../frontend-vue/app/utils/keySaveErrors.ts");

function refused(data) {
  return { status: 409, data };
}

test("savedText expects what the server compares: a text, else none", () => {
  assert.equal(savedText("Save"), "Save");
  assert.equal(savedText(""), null);
  assert.equal(savedText(undefined), null);
  assert.equal(savedText(null), null);
  assert.equal(savedText(5), null, "a number is no text on the server");
  assert.equal(savedText(true), null);
});

test("storedText stores a text made of spaces as no text", () => {
  assert.equal(storedText("  "), null);
  assert.equal(storedText(""), null);
  assert.equal(storedText(" Hi "), " Hi ");
});

test("save ids of a key share its prefix only", () => {
  const id = saveIdOf("site", "a.b", "fr");
  assert.ok(id.startsWith(saveIdPrefix("site", "a.b")));
  assert.ok(
    !saveIdOf("site", "a.bc", "fr").startsWith(saveIdPrefix("site", "a.b")),
  );
});

test("carriedExpected keeps a check while the earlier write landed", () => {
  const landed = { sent: "A", expected: "X", isLanded: true };
  assert.equal(carriedExpected("A", landed), "A");
  assert.equal(carriedExpected("A", undefined), "A");
});

test("carriedExpected never expects a text the server refused", () => {
  const failed = { sent: "A", expected: "X", isLanded: false };
  assert.equal(carriedExpected("A", failed), "X");
  assert.equal(carriedExpected(null, { ...failed, sent: null }), "X");
  assert.equal(carriedExpected("B", failed), "B", "another text is kept");
  assert.equal(carriedExpected(undefined, failed), undefined);
});

test("withEntry sets and removes one entry without touching the record", () => {
  const record = { a: 1 };
  assert.deepEqual(withEntry(record, "b", 2), { a: 1, b: 2 });
  assert.deepEqual(withEntry(record, "a", undefined), {});
  assert.deepEqual(record, { a: 1 });
});

test("keySaveFailure classifies a refused write by its code", () => {
  const conflict = keySaveFailure(
    refused({ code: "conflict", current: { fr: "Autre" } }),
  );
  assert.equal(conflict.kind, "conflict");
  assert.deepEqual(conflict.current, { fr: "Autre" });
  assert.equal(
    keySaveFailure({ data: { code: "key_not_found" } }).kind,
    "deleted",
  );
  const invalid = keySaveFailure({
    data: { code: "invalid_message", details: ["Bare @"] },
  });
  assert.equal(invalid.kind, "invalid");
  assert.deepEqual(invalid.details, ["Bare @"]);
});

test("keySaveFailure needs the code: a bare 409 or a prototype name is other", () => {
  assert.equal(keySaveFailure(refused({ current: { fr: "x" } })).kind, "other");
  assert.equal(keySaveFailure({ data: { code: "constructor" } }).kind, "other");
  assert.equal(keySaveFailure({ data: "<html>" }).kind, "other");
  assert.equal(keySaveFailure(undefined).kind, "other");
});
