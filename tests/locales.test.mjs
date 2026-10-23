import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkMessage,
  placeholdersOf,
} from "../frontend-vue/app/utils/translations.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES = join(ROOT, "frontend-vue/i18n/locales");
const SOURCES = [
  { root: join(ROOT, "src"), extensions: [".ts"], skip: ["test"] },
  {
    root: join(ROOT, "frontend-vue/app"),
    extensions: [".ts", ".vue"],
    skip: [],
  },
];
const KEY_REFERENCE = /\$?(dms_lang(?:\.\w+)+)(\.?\$\{)?/g;
const TRANSLATE_CALL = /(?<![\w$.])\$?t\(\s*(['"])(dms_lang(?:\.\w+)+)\1/g;
const QUOTED_KEY = /(['"])(dms_lang(?:\.\w+)+)\1/g;
const CONST_STRING = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*(["'`])([^"'`]*)\2/g;
const CONST_TEMPLATE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

function flatten(messages, prefix = "", out = new Map()) {
  for (const [name, value] of Object.entries(messages)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (value && typeof value === "object") flatten(value, key, out);
    else out.set(key, value);
  }
  return out;
}

function readLocale(file) {
  return flatten(JSON.parse(readFileSync(join(LOCALES, file), "utf8")));
}

const SOURCE_FILE = "lang-en-GB.json";
/** A placeholder, a linked message or a path: what a translation keeps as is. */
const UNTRANSLATED_PART = /\{[^}]*\}|@:[\w.]+|\S*\/\S*/g;
/** A word or an identifier such as `node_modules` or `vue-i18n`. */
const WORD = /\p{L}[\p{L}\w-]+/gu;

const en = readLocale(SOURCE_FILE);
const fr = readLocale("lang-fr-FR.json");
/** Every language shipped next to English, by file name. */
const translations = readdirSync(LOCALES)
  .filter((file) => file.endsWith(".json") && file !== SOURCE_FILE)
  .map((file) => ({ file, messages: readLocale(file) }));
const branches = new Set(
  [...en.keys()].flatMap((key) =>
    key
      .split(".")
      .slice(1)
      .map((_, index) =>
        key
          .split(".")
          .slice(0, index + 1)
          .join("."),
      ),
  ),
);

function filesOf({ root, extensions, skip }) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory())
      return skip.includes(entry.name)
        ? []
        : filesOf({ root: path, extensions, skip });
    return extensions.some((extension) => entry.name.endsWith(extension))
      ? [path]
      : [];
  });
}

const files = SOURCES.flatMap((source) =>
  filesOf(source).map((path) => ({
    path,
    isBackend: source.root.endsWith("src"),
    text: readFileSync(path, "utf8"),
  })),
);

function constantsOf(text) {
  return Object.fromEntries(
    [...text.matchAll(CONST_STRING)].map((match) => [match[1], match[3]]),
  );
}

/** `${TEXTS}.kpis.keys` written out with the constants of the file, then the shared ones. */
function resolveConstants(text, shared) {
  const constants = { ...shared, ...constantsOf(text) };
  let resolved = text;
  for (let pass = 0; pass < 3; pass += 1) {
    resolved = resolved.replace(CONST_TEMPLATE, (all, name) =>
      typeof constants[name] === "string" && !constants[name].includes("${")
        ? constants[name]
        : all,
    );
    for (const [name, value] of Object.entries(constants))
      constants[name] = value.replace(CONST_TEMPLATE, (all, inner) =>
        inner in constants && !constants[inner].includes("${")
          ? constants[inner]
          : all,
      );
  }
  return { resolved, prefixes: new Set(Object.values(constants)) };
}

const sharedConstants = Object.assign(
  {},
  ...files
    .filter((file) => file.isBackend)
    .map((file) => constantsOf(file.text)),
);

function backendReferences(file) {
  const { resolved, prefixes } = resolveConstants(file.text, sharedConstants);
  return [...resolved.matchAll(KEY_REFERENCE)]
    .filter((match) => !match[2])
    .map((match) => ({
      key: match[1],
      canBeBranch: prefixes.has(match[0]) || prefixes.has(match[1]),
    }));
}

function frontendReferences(file) {
  const calls = [...file.text.matchAll(TRANSLATE_CALL)].map((match) => ({
    key: match[2],
    canBeBranch: false,
  }));
  const literals = [...file.text.matchAll(QUOTED_KEY)].map((match) => ({
    key: match[2],
    canBeBranch: true,
  }));
  return [...calls, ...literals];
}

const references = files.flatMap((file) =>
  (file.isBackend ? backendReferences(file) : frontendReferences(file)).map(
    (reference) => ({
      ...reference,
      file: relative(ROOT, file.path).split("\\").join("/"),
    }),
  ),
);

test("every language has the keys of English, and no other", () => {
  assert.ok(translations.length > 0, "the translations were found");
  for (const { file, messages } of translations) {
    assert.deepEqual(
      [...en.keys()].filter((key) => !messages.has(key)),
      [],
      `missing in ${file}`,
    );
    assert.deepEqual(
      [...messages.keys()].filter((key) => !en.has(key)),
      [],
      `missing in ${SOURCE_FILE}`,
    );
  }
});

/**
 * A text of several words left as its English source was not translated. A
 * single word ("Description", "Type", "DMS") may well read the same in both
 * languages, and placeholders and paths are never translated.
 */
test("no sentence is left in English in another language", () => {
  const wordsOf = (value) =>
    String(value).replace(UNTRANSLATED_PART, " ").match(WORD) ?? [];
  const untranslated = translations.flatMap(({ file, messages }) =>
    [...en]
      .filter(
        ([key, value]) =>
          wordsOf(value).length > 1 && messages.get(key) === value,
      )
      .map(([key, value]) => `${file} ${key}: ${JSON.stringify(value)}`),
  );
  assert.deepEqual(untranslated, []);
});

test("every message is a vue-i18n message that compiles, without stray spaces", () => {
  const problemsOf = (value) =>
    typeof value === "string"
      ? checkMessage("", value).map((issue) => issue.kind)
      : ["not a text"];
  const broken = Object.entries({ en, fr }).flatMap(([language, messages]) =>
    [...messages]
      .filter(([, value]) => problemsOf(value).length > 0)
      .map(
        ([key, value]) =>
          `${language} ${key} (${problemsOf(value).join(", ")}): ${JSON.stringify(value)}`,
      ),
  );
  assert.deepEqual(broken, []);
});

test("both languages use the same variables", () => {
  const sorted = (value) => placeholdersOf(value).sort().join(",");
  const different = [...en]
    .filter(([key, value]) => sorted(value) !== sorted(fr.get(key)))
    .map(([key]) => key);
  assert.deepEqual(different, []);
});

test("every key the code names exists", () => {
  assert.ok(references.length > 100, "the key references were found");
  const missing = references
    .filter(
      ({ key, canBeBranch }) =>
        !en.has(key) && !(canBeBranch && branches.has(key)),
    )
    .map(({ key, file }) => `${file}: ${key}`);
  assert.deepEqual([...new Set(missing)], []);
});

test("every error reason of the API has a message", () => {
  const source = readFileSync(join(ROOT, "src/utils/errors.ts"), "utf8");
  const statuses = source.slice(
    source.indexOf("ERROR_STATUS = {"),
    source.indexOf("} as const"),
  );
  const reasons = source.slice(
    source.indexOf("export type ErrorReason"),
    source.indexOf("export type ErrorDetails"),
  );
  const keys = [
    ...[...statuses.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]),
    ...[...reasons.matchAll(/"(\w+)"/g)].map((match) => match[1]),
  ];
  assert.ok(keys.length > 30, "the error reasons were found");
  assert.deepEqual(
    keys.filter((key) => !en.has(`dms_lang.errors.${key}`)),
    [],
  );
});

test("every error of the message compiler has a sentence", async () => {
  const { CompileErrorCodes } = await import("@intlify/message-compiler");
  assert.deepEqual(
    Object.keys(CompileErrorCodes)
      .map((name) => `dms_lang.errors.message_syntax.${name.toLowerCase()}`)
      .filter((key) => !en.has(key)),
    [],
  );
});
