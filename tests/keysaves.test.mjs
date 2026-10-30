import assert from "node:assert/strict";
import { test } from "node:test";
import * as translations from "../frontend-vue/app/utils/translations.ts";
import * as mutations from "../frontend-vue/app/composables/translation/useMutationToast.ts";

Object.assign(globalThis, translations, mutations, {
  /**
   * @param {(key: string, params: object) => string} translate
   * @param {string} message
   */
  resolveApiMessage: (translate, message) =>
    message.startsWith("$") ? translate(message.slice(1), {}) : message,
});

/** @type {{ [key: string]: string }} */
const TEXTS = {
  "dms_lang.errors.message_syntax.bare_at": "Write @ as {'@'}.",
};

/** @param {string} key */
function translate(key) {
  return TEXTS[key] ?? key;
}

const {
  carriedExpected,
  queueTexts,
  saveIdOf,
  saveIdPrefix,
  savedText,
  storedText,
  withEntry,
} = await import("../frontend-vue/app/utils/keySaves.ts");
const { keySaveFailure } =
  await import("../frontend-vue/app/utils/keySaveErrors.ts");

/** @typedef {import("../frontend-vue/app/utils/keySaves.ts").ExpectedText} ExpectedText */

/** @param {object} data */
function refused(data) {
  return { status: 409, data };
}

void test("savedText expects what the server compares: a text, else none", () => {
  assert.equal(savedText("Save"), "Save");
  assert.equal(savedText(""), null);
  assert.equal(savedText(undefined), null);
  assert.equal(savedText(null), null);
  assert.equal(savedText(5), null, "a number is no text on the server");
  assert.equal(savedText(true), null);
});

void test("storedText stores a text made of spaces as no text", () => {
  assert.equal(storedText("  "), null);
  assert.equal(storedText(""), null);
  assert.equal(storedText(" Hi "), " Hi ");
});

void test("save ids of a key share its prefix only", () => {
  const id = saveIdOf("site", "a.b", "fr");
  assert.ok(id.startsWith(saveIdPrefix("site", "a.b")));
  assert.ok(
    !saveIdOf("site", "a.bc", "fr").startsWith(saveIdPrefix("site", "a.b")),
  );
});

void test("carriedExpected keeps a check while the earlier write landed", () => {
  const landed = { sent: "A", expected: "X", isLanded: true };
  assert.equal(carriedExpected("A", landed), "A");
  assert.equal(carriedExpected("A", undefined), "A");
});

void test("carriedExpected never expects a text the server refused", () => {
  const failed = { sent: "A", expected: "X", isLanded: false };
  assert.equal(carriedExpected("A", failed), "X");
  assert.equal(carriedExpected(null, { ...failed, sent: null }), "X");
  assert.equal(carriedExpected("B", failed), "B", "another text is kept");
  assert.equal(carriedExpected(undefined, failed), undefined);
});

void test("withEntry sets and removes one entry without touching the record", () => {
  const record = { a: 1 };
  assert.deepEqual(withEntry(record, "b", 2), { a: 1, b: 2 });
  assert.deepEqual(withEntry(record, "a", undefined), {});
  assert.deepEqual(record, { a: 1 });
});

void test("keySaveFailure classifies a refused write by its code", () => {
  const conflict = keySaveFailure(
    refused({ code: "conflict", current: { fr: "Autre" } }),
    translate,
  );
  assert.equal(conflict.kind, "conflict");
  assert.deepEqual(conflict.current, { fr: "Autre" });
  assert.equal(
    keySaveFailure({ data: { code: "key_not_found" } }, translate).kind,
    "deleted",
  );
  const invalid = keySaveFailure(
    {
      data: {
        code: "invalid_message",
        details: ["$dms_lang.errors.message_syntax.bare_at"],
      },
    },
    translate,
  );
  assert.equal(invalid.kind, "invalid");
  assert.deepEqual(invalid.details, ["Write @ as {'@'}."]);
});

void test("keySaveFailure needs the code: a bare 409 or a prototype name is other", () => {
  assert.equal(
    keySaveFailure(refused({ current: { fr: "x" } }), translate).kind,
    "other",
  );
  assert.equal(
    keySaveFailure({ data: { code: "constructor" } }, translate).kind,
    "other",
  );
  assert.equal(keySaveFailure({ data: "<html>" }, translate).kind, "other");
  assert.equal(keySaveFailure(undefined, translate).kind, "other");
});

void test("queueTexts runs the writes of a text in order", async () => {
  /** @type {Parameters<typeof queueTexts>[0]} */
  const links = new Map();
  /** @type {string[]} */
  const order = [];
  /** @type {PromiseWithResolvers<void>} */
  const first = Promise.withResolvers();
  const one = queueTexts(
    links,
    [{ id: "fr", text: "A", expected: "X" }],
    async () => {
      await first.promise;
      order.push("A");
      return true;
    },
    Boolean,
  );
  const two = queueTexts(
    links,
    [{ id: "fr", text: "B", expected: "A" }],
    async () => {
      order.push("B");
      return true;
    },
    Boolean,
  );
  first.resolve();
  await Promise.all([one, two]);
  assert.deepEqual(order, ["A", "B"]);
});

void test("queueTexts never expects a text whose write failed in flight", async () => {
  /** @type {Parameters<typeof queueTexts>[0]} */
  const links = new Map();
  /** @type {ExpectedText[][]} */
  const sent = [];
  /** @param {boolean} landed */
  const send = (landed) => async (/** @type {ExpectedText[]} */ expected) => {
    sent.push(expected);
    return landed;
  };
  const failed = queueTexts(
    links,
    [{ id: "fr", text: "A", expected: "X" }],
    send(false),
    Boolean,
  );
  const next = queueTexts(
    links,
    [{ id: "fr", text: "B", expected: "A" }],
    send(true),
    Boolean,
  );
  await Promise.all([failed, next]);
  assert.deepEqual(sent, [["X"], ["X"]]);
});

void test("queueTexts waits on every text of a write", async () => {
  /** @type {Parameters<typeof queueTexts>[0]} */
  const links = new Map();
  /** @type {PromiseWithResolvers<void>} */
  const de = Promise.withResolvers();
  /** @type {(string | ExpectedText[])[]} */
  const order = [];
  const single = queueTexts(
    links,
    [{ id: "de", text: "D", expected: null }],
    async () => {
      await de.promise;
      order.push("de");
      return true;
    },
    Boolean,
  );
  const both = queueTexts(
    links,
    [
      { id: "fr", text: "F", expected: null },
      { id: "de", text: "E", expected: "D" },
    ],
    async (expected) => {
      order.push(["both", ...expected]);
      return true;
    },
    Boolean,
  );
  de.resolve();
  await Promise.all([single, both]);
  assert.deepEqual(order, ["de", ["both", null, "D"]]);
});
