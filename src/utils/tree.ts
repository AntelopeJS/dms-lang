import { isPlainObject } from "./json";
import { isObject, isString } from "./guards";

export type TranslationValue = string | number | boolean | null | undefined;

export interface LocaleMessages {
  [locale: string]: Record<string, unknown>;
}

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.assign(
    Object.create(null),
    target,
  );

  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isPlainObject(value)) {
      const current = result[key];
      result[key] = deepMerge(isPlainObject(current) ? current : {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function getValueAtPath(
  obj: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!obj || !path) return undefined;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (isObject(current) && Object.hasOwn(current, key)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/** A value with no text: absent, null, empty or made of spaces only. */
export function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return isString(value) && value.trim() === "";
}

/** The keys of every locale merged: a key exists as soon as one language file holds it. */
export function unionKeys(messages: LocaleMessages): Record<string, unknown> {
  let union: Record<string, unknown> = {};
  for (const localeMessages of Object.values(messages)) {
    union = deepMerge(union, localeMessages);
  }
  return union;
}

/** The leaf paths of a key tree, in file order; empty namespaces hold no key. */
export function leafPaths(
  keys: Record<string, unknown>,
  prefix = "",
): string[] {
  return Object.entries(keys).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isPlainObject(value) ? leafPaths(value, path) : [path];
  });
}
