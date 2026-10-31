import { check, fail } from "./errors";
import {
  deleteAtPath,
  insertAtPath,
  isJsonObject,
  type JsonObject,
  type JsonValue,
  leafPrefixOf,
  namesFrom,
  type NodeKind,
  nodeKindAt,
  setAtPath,
  validateKeyPath,
  validateNewKeyPath,
} from "./json";
import { findLocale } from "./locale-codes";
import { assertMessageSyntax } from "./message-syntax";
import { getValueAtPath, isMissing, type LocaleMessages } from "./tree";
import { isString } from "./guards";

/** Texts by locale: a string is written, `null` removes the value. */
export type LocaleTexts = Record<string, string | null>;

export interface KeyChange {
  path: string;
  newPath?: string;
  texts?: LocaleTexts;
  messages: LocaleMessages;
}

/** Where the keys of a workspace live and how a write reaches them. */
export interface KeyStore {
  locales: string[];
  baseLocale: string;
  /** What the workspace holds per locale. */
  messages: LocaleMessages;
  /** Read-only keys that count as existing (the modules under the project files). */
  reference: LocaleMessages;
  /**
   * The file of a locale the key at `segments` is written to; a store split
   * in several files per locale picks the one that key belongs in.
   */
  load(locale: string, segments: string[]): JsonObject;
  /** Writes back what {@link KeyStore.load} returned for the same locale and key. */
  save(locale: string, data: JsonObject, segments: string[]): void;
  track?(change: KeyChange): void;
}

function layersOf(messages: LocaleMessages): JsonObject[] {
  return Object.values(messages);
}

function kindsAt(messages: LocaleMessages, segments: string[]): NodeKind[] {
  return layersOf(messages).map((data) => nodeKindAt(data, segments));
}

function hasLeaf(messages: LocaleMessages, segments: string[]): boolean {
  return kindsAt(messages, segments).includes("leaf");
}

function hasBranch(messages: LocaleMessages, segments: string[]): boolean {
  return kindsAt(messages, segments).includes("branch");
}

function namespaceSize(messages: LocaleMessages, path: string): number {
  const keys = new Set<string>();
  const collect = (node: JsonValue, prefix: string): void => {
    if (!isJsonObject(node)) {
      keys.add(prefix);
      return;
    }
    for (const [key, child] of Object.entries(node))
      collect(child, `${prefix}.${key}`);
  };
  for (const data of layersOf(messages))
    collect(getValueAtPath(data, path) ?? {}, path);
  keys.delete(path);
  return keys.size;
}

function leafPrefix(
  messages: LocaleMessages,
  segments: string[],
): string | undefined {
  return layersOf(messages)
    .map((data) => leafPrefixOf(data, segments))
    .find((prefix) => prefix !== undefined);
}

/** 409 unless a key can be written at `segments` without overwriting a key or a namespace. */
function assertFreePath(
  messages: LocaleMessages,
  reference: LocaleMessages,
  segments: string[],
): void {
  const path = segments.join(".");
  check(!hasLeaf(messages, segments), "key_exists", { path });
  check(!hasLeaf(reference, segments), "module_key", { path });
  const both = { ...prefixed(messages, "own"), ...prefixed(reference, "ref") };
  if (hasBranch(both, segments)) {
    const size = namespaceSize(both, path);
    fail("key_conflict", { path, size, conflicts: [path] });
  }
  const prefix = leafPrefix(both, segments);
  check(prefix === undefined, "key_conflict", { path, conflicts: [prefix] });
}

function prefixed(messages: LocaleMessages, tag: string): LocaleMessages {
  return Object.fromEntries(
    Object.entries(messages).map(([locale, data]): [string, JsonObject] => [
      `${tag}:${locale}`,
      data,
    ]),
  );
}

function storeLocale(store: KeyStore, code: string): string {
  const found = findLocale(store.locales, code);
  if (found === undefined) fail("undeclared_locale", { locale: code });
  return found;
}

function textOf(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/** The texts of a request on the locales of the store; an empty text is no text. */
function parseTexts(store: KeyStore, values: LocaleTexts = {}) {
  const texts: LocaleTexts = {};
  for (const [code, value] of Object.entries(values))
    texts[storeLocale(store, code)] = textOf(value);
  return texts;
}

function validateTexts(store: KeyStore, values: LocaleTexts): LocaleTexts {
  const texts = parseTexts(store, values);
  for (const [locale, text] of Object.entries(texts)) {
    if (text !== null) assertMessageSyntax(locale, text);
  }
  return texts;
}

function currentText(
  data: JsonObject | undefined,
  path: string,
): string | null {
  const value = getValueAtPath(data, path);
  return isString(value) && !isMissing(value) ? value : null;
}

function assertExpected(
  store: KeyStore,
  path: string,
  texts: LocaleTexts,
  expected?: LocaleTexts,
): void {
  const wanted = parseTexts(store, expected);
  const changed = Object.entries(wanted).filter(
    ([locale, text]) => currentText(store.messages[locale], path) !== text,
  );
  if (changed.length === 0) return;
  const current: LocaleTexts = {};
  for (const locale of new Set([...Object.keys(texts), ...Object.keys(wanted)]))
    current[locale] = currentText(store.messages[locale], path);
  fail("conflict", { path, current });
}

function countTexts(messages: LocaleMessages, path: string): number {
  return layersOf(messages).filter((data) => currentText(data, path) !== null)
    .length;
}

function applyTexts(
  store: KeyStore,
  segments: string[],
  texts: LocaleTexts,
  before?: string[],
): void {
  for (const [locale, text] of Object.entries(texts)) {
    const data = store.load(locale, segments);
    if (text === null) deleteAtPath(data, segments);
    else insertAtPath(data, segments, text, before);
    store.save(locale, data, segments);
  }
}

/**
 * The names of the siblings a new key goes right before, from the path of the
 * sibling it followed (`cart.badge` for `cart.title`): that sibling, then the
 * ones after it in the base file (in another file when the base lacks it), so
 * a file without that sibling still gets the key at its rank. Undefined to
 * append the key.
 */
function siblingNames(
  store: KeyStore,
  segments: string[],
  before?: string | null,
): string[] | undefined {
  if (before === undefined || before === null) return undefined;
  const sibling = validateKeyPath(before);
  const parent = segments.slice(0, -1);
  check(
    sibling.length === segments.length &&
      sibling.slice(0, -1).join(".") === parent.join("."),
    "invalid_body",
    { before },
    "invalid_before",
  );
  const files = [store.baseLocale, ...store.locales].map(
    (locale) => store.messages[locale],
  );
  return namesFrom(files, parent, sibling.at(-1) ?? "");
}

function applyInMemory(
  messages: LocaleMessages,
  segments: string[],
  texts: LocaleTexts,
): LocaleMessages {
  const next = structuredClone(messages);
  for (const [locale, text] of Object.entries(texts)) {
    next[locale] ??= {};
    if (text === null) deleteAtPath(next[locale], segments);
    else setAtPath(next[locale], segments, text);
  }
  return next;
}

/**
 * Creates a key with its texts, right before the sibling path `before` when
 * given; 409 when it exists or would overwrite a key or a namespace.
 */
export function createKey(
  store: KeyStore,
  path: string,
  values: LocaleTexts,
  before?: string | null,
): void {
  const segments = validateNewKeyPath(path);
  const siblings = siblingNames(store, segments, before);
  const texts = validateTexts(store, values);
  check(
    Object.values(texts).some((text) => text !== null),
    "invalid_value",
    { path },
    "empty_key",
  );
  assertFreePath(store.messages, store.reference, segments);
  const written = Object.fromEntries(
    Object.entries(texts).filter(([, text]) => text !== null),
  );
  applyTexts(store, segments, written, siblings);
  const key = segments.join(".");
  store.track?.({
    path: key,
    texts: written,
    messages: applyInMemory(store.messages, segments, written),
  });
}

function assertKeyOf(store: KeyStore, segments: string[]): void {
  const path = segments.join(".");
  if (hasLeaf(store.messages, segments) || hasLeaf(store.reference, segments))
    return;
  check(
    !hasBranch(store.messages, segments) &&
      !hasBranch(store.reference, segments),
    "not_a_key",
    { path },
  );
  fail("key_not_found", { path });
}

function assertWritable(
  store: KeyStore,
  segments: string[],
  texts: LocaleTexts,
): void {
  for (const locale of Object.keys(texts)) {
    const single = { [locale]: store.messages[locale] ?? {} };
    const prefix = leafPrefix(single, segments);
    const path = segments.join(".");
    check(
      prefix === undefined && !hasBranch(single, segments),
      "key_conflict",
      { path, locale, conflicts: [prefix ?? path] },
    );
  }
}

/** Changes the texts of an existing key; 404 when it no longer exists, 409 when `expected` is stale. */
export function updateKey(
  store: KeyStore,
  path: string,
  values: LocaleTexts,
  expected?: LocaleTexts,
): void {
  const segments = validateKeyPath(path);
  const key = segments.join(".");
  assertKeyOf(store, segments);
  const texts = validateTexts(store, values);
  assertExpected(store, key, texts, expected);
  assertWritable(store, segments, texts);
  const next = applyInMemory(store.messages, segments, texts);
  check(
    countTexts(next, key) > 0 ||
      hasLeaf(store.reference, segments) ||
      countTexts(store.messages, key) === 0,
    "last_value",
    { path: key },
  );
  applyTexts(store, segments, texts);
  store.track?.({ path: key, texts, messages: next });
}

function assertOwnKey(store: KeyStore, segments: string[]): void {
  const path = segments.join(".");
  if (hasLeaf(store.messages, segments)) return;
  check(!hasBranch(store.messages, segments), "not_a_key", { path });
  fail(
    "key_not_found",
    { path },
    hasLeaf(store.reference, segments) ? "module_key_locked" : "key_not_found",
  );
}

/**
 * Moves a key in every locale, within the file that defines it; 409 when the
 * target holds a key or a namespace.
 */
export function renameKey(
  store: KeyStore,
  path: string,
  newPath: string,
): string {
  const from = validateKeyPath(path);
  const to = validateNewKeyPath(newPath);
  const source = from.join(".");
  const target = to.join(".");
  check(source !== target, "invalid_key_path", { path }, "same_key_path");
  assertOwnKey(store, from);
  const remaining = structuredClone(store.messages);
  for (const data of layersOf(remaining)) deleteAtPath(data, from);
  assertFreePath(remaining, store.reference, to);
  for (const locale of store.locales) {
    const value = getValueAtPath(store.messages[locale], source);
    if (value === undefined || isJsonObject(value)) continue;
    const data = store.load(locale, from);
    deleteAtPath(data, from);
    setAtPath(data, to, value);
    store.save(locale, data, from);
  }
  store.track?.({ path: source, newPath: target, messages: remaining });
  return target;
}

/** Deletes a key in every locale; a namespace is refused. */
export function deleteKey(store: KeyStore, path: string): void {
  const segments = validateKeyPath(path);
  assertOwnKey(store, segments);
  const key = segments.join(".");
  for (const locale of store.locales) {
    if (nodeKindAt(store.messages[locale], segments) !== "leaf") continue;
    const data = store.load(locale, segments);
    deleteAtPath(data, segments);
    store.save(locale, data, segments);
  }
  store.track?.({ path: key, messages: store.messages });
}

/** The locales a request names (`locales`, a list of codes), every locale of the store when absent. */
function targetLocales(store: KeyStore, locales?: string[]): string[] {
  return locales
    ? locales.map((code) => storeLocale(store, code))
    : store.locales;
}

/** Removes the project values of a module key so the module text shows again. */
export function removeOverride(
  store: KeyStore,
  path: string,
  locales?: string[],
): void {
  const segments = validateKeyPath(path);
  check(hasLeaf(store.reference, segments), "not_an_override", { path });
  for (const locale of targetLocales(store, locales)) {
    if (nodeKindAt(store.messages[locale], segments) !== "leaf") continue;
    const data = store.load(locale, segments);
    deleteAtPath(data, segments);
    store.save(locale, data, segments);
  }
}

/**
 * Marks the translations of a key as checked against the current base text
 * without changing them: the review tracking records them as written for it,
 * so they leave "To review". Only the given locales (all when absent) that
 * hold a text; nothing when the key has no base text.
 */
export function markReviewed(
  store: KeyStore,
  path: string,
  locales?: string[],
): void {
  const segments = validateKeyPath(path);
  const key = segments.join(".");
  assertKeyOf(store, segments);
  const texts: LocaleTexts = {};
  for (const locale of targetLocales(store, locales)) {
    const text = currentText(store.messages[locale], key);
    if (locale !== store.baseLocale && text !== null) texts[locale] = text;
  }
  store.track?.({ path: key, texts, messages: store.messages });
}
