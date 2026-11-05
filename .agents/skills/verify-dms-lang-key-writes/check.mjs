#!/usr/bin/env node
import { HTTPResult } from "@antelopejs/interface-api";
import { isString } from "../../../dist/utils/guards.js";
import { isJsonObject, nodeKindAt } from "../../../dist/utils/json.js";
import { createKey, deleteKey, removeOverride, renameKey, updateKey } from "../../../dist/utils/keys.js";
import { deepMerge, getValueAtPath, leafPaths } from "../../../dist/utils/tree.js";
import { writeTargetOf } from "../../../dist/utils/write-target.js";
import record from "./record.json" with { type: "json" };

/**
 * @typedef {import("../../../dist/utils/json.js").JsonObject} JsonObject
 * @typedef {import("../../../dist/utils/keys.js").KeyStore} KeyStore
 * @typedef {{ path: string, data: JsonObject }} LocaleFile
 * @typedef {{ rule: string, describe: string, run: (store: KeyStore) => void, expect: (files: LocaleFile[]) => Map<string, string> }} Operation
 * @typedef {{ suffix: string, consistent: boolean }} Scope
 * @typedef {{ names: string[], contents: JsonObject[] }} Layout
 * @typedef {{ rule: string, why: string }} Breach
 */

const LOCALE = "fr-FR";
const KEYS = ["a", "b", "a.a", "a.b", "b.a", "b.b"];
const MAX_FILES = Number(process.env.KEY_WRITES_MAX_FILES ?? 2);
const MODULE_TEXTS = [{}, { a: { a: "module:a.a" } }, { b: "module:b" }];
const BEFORE_FALLBACK = ["app-blog", "app-crm"];
const AFTER_FALLBACK = ["app-shop", "app-wiki"];

/**
 * Consistent files, which the API keeps writing, and the others, which only
 * a hand edit makes. A rule of the second scope ends in `.HandEdited`.
 *
 * @type {Scope[]}
 */
const SCOPES = [
  { suffix: "", consistent: true },
  { suffix: ".HandEdited", consistent: false },
];

/**
 * Every content a project file can hold over the names `a` and `b`, two
 * levels deep: each name absent, a text, an empty namespace, or a namespace
 * of texts. Every text says which file and key hold it.
 *
 * @param {string} tag The file's tag
 * @returns {JsonObject[]} The contents
 */
function fileContents(tag) {
  /** @type {(name: string) => (JsonObject | string | undefined)[]} */
  const options = (name) => {
    /** @type {(JsonObject | string | undefined)[]} */
    const list = [undefined, `${tag}:${name}`];
    for (const first of [false, true])
      for (const second of [false, true]) {
        /** @type {JsonObject} */
        const node = {};
        if (first) node.a = `${tag}:${name}.a`;
        if (second) node.b = `${tag}:${name}.b`;
        list.push(node);
      }
    return list;
  };
  /** @type {JsonObject[]} */
  const contents = [];
  for (const a of options("a"))
    for (const b of options("b")) {
      /** @type {JsonObject} */
      const data = {};
      if (a !== undefined) data.a = a;
      if (b !== undefined) data.b = b;
      contents.push(data);
    }
  return contents;
}

/**
 * The names of `count` project files of the locale with `app-fr-FR.json` at
 * `fallback` (none when out of range), picked so that their sorted order, the
 * order `locale-discovery.ts` merges them in, is the order of the list.
 *
 * @param {number} count How many files
 * @param {number} fallback The index of `app-fr-FR.json`
 * @returns {string[]} The paths
 */
function fileNames(count, fallback) {
  const hasFallback = fallback < count;
  const before = hasFallback ? fallback : count;
  return [
    ...BEFORE_FALLBACK.slice(0, Math.min(before, 2)),
    ...AFTER_FALLBACK.slice(0, Math.max(0, before - 2)),
    ...(hasFallback ? ["app"] : []),
    ...AFTER_FALLBACK.slice(0, count - before - (hasFallback ? 1 : 0)),
  ].map((stem) => `${stem}-${LOCALE}.json`);
}

/**
 * Every layout of up to `MAX_FILES` project files.
 *
 * @returns {Generator<Layout>} The layouts
 */
function* layouts() {
  for (let count = 1; count <= MAX_FILES; count++) {
    const pool = Array.from({ length: count }, (_, index) => fileContents(`f${index}`));
    const total = pool.reduce((product, list) => product * list.length, 1);
    for (let fallback = 0; fallback <= count; fallback++) {
      const names = fileNames(count, fallback);
      for (let combo = 0; combo < total; combo++) {
        let rest = combo;
        const contents = pool.map((list) => {
          const data = list[rest % list.length] ?? {};
          rest = Math.floor(rest / list.length);
          return data;
        });
        yield { names, contents };
      }
    }
  }
}

/**
 * Whether files hold no empty namespace and no key that one file holds as a
 * text and another as a namespace: the files the API keeps writing without a
 * `key_conflict`.
 *
 * @param {JsonObject[]} contents The files' contents
 * @returns {boolean} Whether they are consistent
 */
function consistent(contents) {
  /** @type {Map<string, boolean>} */
  const namespaces = new Map();
  /** @type {(node: JsonObject, prefix: string) => boolean} */
  const walk = (node, prefix) =>
    Object.entries(node).every(([name, value]) => {
      const path = prefix ? `${prefix}.${name}` : name;
      const namespace = isJsonObject(value);
      if ((namespaces.get(path) ?? namespace) !== namespace) return false;
      namespaces.set(path, namespace);
      return isJsonObject(value) ? Object.keys(value).length > 0 && walk(value, path) : true;
    });
  return contents.every((data) => walk(data, ""));
}

/**
 * @param {LocaleFile[]} files The files, in merge order
 * @returns {JsonObject} What the dashboard shows: the files merged as `readMessages` in `registry.ts` merges them
 */
function merged(files) {
  /** @type {JsonObject} */
  const empty = {};
  return files.reduce((view, file) => deepMerge(view, file.data), empty);
}

/**
 * @param {LocaleFile[]} files Files
 * @returns {LocaleFile[]} A deep copy
 */
function copy(files) {
  return files.map((file) => ({ path: file.path, data: structuredClone(file.data) }));
}

/**
 * @param {JsonObject} data A catalog
 * @returns {Map<string, string>} Its texts by key, as JSON
 */
function texts(data) {
  return new Map(leafPaths(data).map((path) => [path, JSON.stringify(getValueAtPath(data, path))]));
}

/**
 * The project key store over in-memory files, built as `ownKeyStore` in
 * `src/utils/own.ts` builds it: the merged messages, the module texts as the
 * reference, and `load` and `save` on the file `writeTargetOf` picks from the
 * files as they are at that moment.
 *
 * @param {LocaleFile[]} files The files, changed in place by `save`
 * @param {JsonObject} reference The module texts
 * @returns {KeyStore} The store
 */
function storeOver(files, reference) {
  /** @type {(segments: string[]) => LocaleFile} */
  const pick = (segments) => {
    const path = writeTargetOf(copy(files), segments);
    const file = files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`writeTargetOf picked no project file for ${segments.join(".")}`);
    return file;
  };
  return {
    locales: [LOCALE],
    baseLocale: LOCALE,
    messages: { [LOCALE]: merged(files) },
    reference: { [LOCALE]: reference },
    load: (_locale, segments) => structuredClone(pick(segments).data),
    save: (_locale, data, segments) => {
      pick(segments).data = structuredClone(data);
    },
  };
}

/**
 * @param {Map<string, string>} shown Texts by key
 * @param {string} path A key
 * @param {string} text Its text
 * @returns {Map<string, string>} The texts with the key showing the text, every other key as it was
 */
function withText(shown, path, text) {
  return new Map(shown).set(path, JSON.stringify(text));
}

/**
 * What the dashboard shows once the winning definition of a key is removed
 * and nothing else of its file: `docs/3.configuration.md` says a delete, a
 * clear or a dropped override removes only that one.
 *
 * @param {LocaleFile[]} files The files, in merge order
 * @param {string} path The key
 * @returns {Map<string, string>} The texts shown after the removal
 */
function withoutWinner(files, path) {
  const next = copy(files);
  const segments = path.split(".");
  const winner = next.findLast((file) => nodeKindAt(file.data, segments) === "leaf");
  const name = segments.at(-1);
  if (winner === undefined || name === undefined) return texts(merged(next));
  const parent = segments.length === 1 ? winner.data : getValueAtPath(winner.data, segments.slice(0, -1).join("."));
  if (isJsonObject(parent)) Reflect.deleteProperty(parent, name);
  return texts(merged(next));
}

/**
 * @param {string} path A key
 * @returns {string[]} The other keys of its namespace, which a new key can be placed before
 */
function siblingsOf(path) {
  const parent = path.split(".").slice(0, -1).join(".");
  return KEYS.filter((key) => key !== path && key.split(".").slice(0, -1).join(".") === parent);
}

/**
 * The operations the API runs on project keys, each with what the docs
 * promise the dashboard shows afterwards.
 *
 * @returns {Operation[]} The operations
 */
function operations() {
  /** @type {Operation[]} */
  const ops = [];
  for (const path of KEYS) {
    ops.push(
      {
        rule: "UpdateShows",
        describe: `PUT /key ${path} = "new"`,
        run: (store) => updateKey(store, path, { [LOCALE]: "new" }),
        expect: (files) => withText(texts(merged(files)), path, "new"),
      },
      {
        rule: "ClearRemovesWinner",
        describe: `PUT /key ${path} = ""`,
        run: (store) => updateKey(store, path, { [LOCALE]: null }),
        expect: (files) => withoutWinner(files, path),
      },
      {
        rule: "CreateShows",
        describe: `POST /key ${path} = "new"`,
        run: (store) => createKey(store, path, { [LOCALE]: "new" }),
        expect: (files) => withText(texts(merged(files)), path, "new"),
      },
      {
        rule: "DeleteRemovesWinner",
        describe: `DELETE /key ${path}`,
        run: (store) => deleteKey(store, path),
        expect: (files) => withoutWinner(files, path),
      },
      {
        rule: "DropOverrideRemovesWinner",
        describe: `DELETE /key/override ${path}`,
        run: (store) => removeOverride(store, path),
        expect: (files) => withoutWinner(files, path),
      },
    );
    for (const before of siblingsOf(path))
      ops.push({
        rule: "CreateShows",
        describe: `POST /key ${path} = "new" before ${before}`,
        run: (store) => createKey(store, path, { [LOCALE]: "new" }, before),
        expect: (files) => withText(texts(merged(files)), path, "new"),
      });
    for (const to of KEYS.filter((key) => key !== path))
      ops.push({
        rule: "RenameMovesWinner",
        describe: `POST /key/rename ${path} -> ${to}`,
        run: (store) => {
          renameKey(store, path, to);
        },
        expect: (files) => {
          const value = getValueAtPath(merged(files), path);
          return isString(value) ? withText(withoutWinner(files, path), to, value) : texts(merged(files));
        },
      });
  }
  return ops;
}

/**
 * @param {Map<string, string>} got The texts shown
 * @param {Map<string, string>} want The texts promised
 * @returns {string | undefined} How they differ
 */
function difference(got, want) {
  for (const [path, value] of want) {
    const shown = got.get(path);
    if (shown !== value) return shown === undefined ? `${path} is gone, not ${value}` : `${path} shows ${shown}, not ${value}`;
  }
  for (const [path, value] of got) if (!want.has(path)) return `${path} still shows ${value}`;
  return undefined;
}

/**
 * Runs one operation on one layout and judges it.
 *
 * @param {Scope} scope The scope of the layout
 * @param {LocaleFile[]} start The files
 * @param {JsonObject} reference The module texts
 * @param {Operation} op The operation
 * @returns {Breach | "refused" | "kept"} The rule it breaks and how, whether the API refused it with a 4xx that left the files as they were, or whether it kept every promise
 */
function judge(scope, start, reference, op) {
  const files = copy(start);
  try {
    op.run(storeOver(files, reference));
  } catch (error) {
    const untouched = JSON.stringify(files) === JSON.stringify(start);
    const status = error instanceof HTTPResult ? error.getStatus() : 500;
    if (status < 500 && untouched) return "refused";
    const what = error instanceof HTTPResult ? `answers ${status} ${error.getBody()}` : `throws ${String(error)}`;
    return { rule: `${op.rule}${scope.suffix}`, why: `the API ${what}${untouched ? "" : " and changed the files"}` };
  }
  const why = difference(texts(merged(files)), op.expect(start));
  if (why !== undefined) return { rule: `${op.rule}${scope.suffix}`, why };
  if (!scope.consistent || consistent(files.map((file) => file.data))) return "kept";
  const after = files.map((file) => `${file.path} = ${JSON.stringify(file.data)}`).join(", ");
  return { rule: "StaysConsistent", why: `the files are no longer consistent: ${after}` };
}

/**
 * @param {Layout} layout The files
 * @param {JsonObject} reference The module texts
 * @param {Operation} op The operation
 * @param {string} why How it broke its promise
 * @returns {string} The counterexample, in the API's and the files' words
 */
function counterexample(layout, reference, op, why) {
  const files = layout.names.map((name, index) => `  ${name} = ${JSON.stringify(layout.contents[index])}`);
  return [
    `${op.describe}, with the project files (merge order):`,
    ...files,
    `  module texts = ${JSON.stringify(reference)}`,
    `  then ${why}`,
  ].join("\n");
}

const ops = operations();
/** @type {Map<string, { size: number, text: string }>} */
const found = new Map();
let accepted = 0;
for (const layout of layouts()) {
  const isConsistent = consistent(layout.contents);
  const scope = SCOPES.find((entry) => entry.consistent === isConsistent) ?? SCOPES[0];
  const start = layout.names.map((path, index) => ({ path, data: layout.contents[index] ?? {} }));
  const size = JSON.stringify(layout.contents).length;
  for (const reference of MODULE_TEXTS)
    for (const op of ops) {
      const breach = judge(scope, start, reference, op);
      if (breach === "refused") continue;
      accepted++;
      if (breach === "kept") continue;
      const seen = found.get(breach.rule);
      if (seen === undefined || size < seen.size)
        found.set(breach.rule, { size, text: counterexample(layout, reference, op, breach.why) });
    }
}

const rules = ["StaysConsistent", ...SCOPES.flatMap((scope) => [...new Set(ops.map((op) => `${op.rule}${scope.suffix}`))])];
const recorded = new Set(record.violated);
const listed = new Set([...record.holds, ...record.violated]);
let drift = false;
for (const rule of listed)
  if (!rules.includes(rule)) {
    drift = true;
    console.error(`${rule} is in record.json but the check no longer has it`);
  }
for (const rule of rules)
  if (!listed.has(rule)) {
    drift = true;
    console.error(`${rule} is missing from record.json`);
  }
for (const rule of rules) {
  const hit = found.get(rule);
  console.log(hit === undefined ? `HOLDS ${rule}` : `VIOLATED ${rule}\n${hit.text}`);
  if (recorded.has(rule) === (hit !== undefined)) continue;
  drift = true;
  console.error(`${rule} ${recorded.has(rule) ? "no longer fails" : "fails"}, unlike record.json`);
}
console.log(`checked ${accepted} accepted operations on up to ${MAX_FILES} project files`);
process.exitCode = drift ? 1 : 0;
