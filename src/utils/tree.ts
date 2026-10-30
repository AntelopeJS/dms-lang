import { isJsonObject, type JsonObject, type JsonValue } from "./json";
import { isObject, isString } from "./guards";

export type TranslationValue = string | number | boolean | null | undefined;

export interface LocaleMessages {
  [locale: string]: Record<string, unknown>;
}

/** The language files of a workspace, merged per locale. */
export type LocaleTrees = Record<string, JsonObject>;

export function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result: JsonObject = { __proto__: null, ...target };

  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isJsonObject(value)) {
      const current = result[key];
      result[key] = deepMerge(isJsonObject(current) ? current : {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/** The own property `key` of an object or an array (an index or `length`), as `node[key]` reads it. */
function ownMember(node: JsonObject | JsonValue[], key: string): JsonValue {
  if (!Array.isArray(node)) return node[key];
  return key === "length" ? node.length : node[Number(key)];
}

export function getValueAtPath(
  obj: JsonObject | undefined,
  path: string,
): JsonValue | undefined {
  if (!obj || !path) return undefined;

  const keys = path.split(".");
  let current: JsonValue | undefined = obj;

  for (const key of keys) {
    if (isObject(current) && Object.hasOwn(current, key)) {
      current = ownMember(current, key);
    } else {
      return undefined;
    }
  }

  return current;
}

/** A value with no text: absent, null, empty or made of spaces only. */
export function isMissing(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  return isString(value) && value.trim() === "";
}

/** The keys of every locale merged: a key exists as soon as one language file holds it. */
export function unionKeys(messages: LocaleTrees): JsonObject {
  let union: JsonObject = {};
  for (const localeMessages of Object.values(messages)) {
    union = deepMerge(union, localeMessages);
  }
  return union;
}

/** The leaf paths of a key tree, in file order; empty namespaces hold no key. */
export function leafPaths(keys: JsonObject, prefix = ""): string[] {
  return Object.entries(keys).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isJsonObject(value) ? leafPaths(value, path) : [path];
  });
}
