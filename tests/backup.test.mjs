import assert from "node:assert/strict";
import { test } from "node:test";
import * as languages from "../frontend-vue/app/utils/languages.ts";

Object.assign(globalThis, languages);

const { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, readBackup } =
  await import("../frontend-vue/app/utils/workspaceBackup.ts");

const MESSAGES = { en: { hello: "Hello" }, fr: { hello: "Bonjour" } };

void test("a backup of this format and version is read as it is", () => {
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    id: "web",
    description: "Site",
    messages: MESSAGES,
  };
  assert.deepEqual(readBackup(backup), { backup });
});

void test("a backup without format or version is read", () => {
  assert.deepEqual(readBackup({ messages: MESSAGES }), {
    backup: { messages: MESSAGES },
  });
});

void test("a backup of a newer version is refused as newer", () => {
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION + 1,
    messages: MESSAGES,
  };
  assert.deepEqual(readBackup(backup), { problem: "newer" });
});

void test("another format or a version that is no version is no backup", () => {
  assert.deepEqual(readBackup({ format: "other", messages: MESSAGES }), {
    problem: "invalid",
  });
  for (const version of [0, 1.5, "1", null]) {
    assert.deepEqual(
      readBackup({ format: BACKUP_FORMAT, version, messages: MESSAGES }),
      { problem: "invalid" },
      `version ${version}`,
    );
  }
});

void test("an export of every language and one language file are workspaces", () => {
  assert.deepEqual(readBackup(MESSAGES), { backup: { messages: MESSAGES } });
  assert.deepEqual(readBackup({ hello: "Ciao" }, "it.json"), {
    backup: { messages: { it: { hello: "Ciao" } } },
  });
});

void test("anything else, or no JSON, is no workspace", () => {
  assert.deepEqual(readBackup({ hello: "Ciao" }, "notes.json"), {
    problem: "invalid",
  });
  assert.deepEqual(readBackup([MESSAGES]), { problem: "invalid" });
  assert.deepEqual(parseBackup("{", "it.json"), { problem: "invalid" });
  assert.deepEqual(parseBackup(JSON.stringify(MESSAGES), "all.json"), {
    backup: { messages: MESSAGES },
  });
});
