export type TranslationValue = string | number | boolean | null | undefined;

export interface TreeItem {
  label: string;
  value: string;
  children?: TreeItem[];
  defaultExpanded?: boolean;
  trailingIcon?: string;
}

export interface LocaleMessages {
  [locale: string]: Record<string, unknown>;
}

const MISSING_ICON = "i-lucide-circle-alert";
export const PROGRESS_PRECISION_FACTOR = 10000;
export const FULL_PROGRESS = 100;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
    if (isObject(value)) {
      const current = result[key];
      result[key] = deepMerge(isObject(current) ? current : {}, value);
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
    if (current && typeof current === "object" && Object.hasOwn(current, key)) {
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
  return typeof value === "string" && value.trim() === "";
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
    return isObject(value) ? leafPaths(value, path) : [path];
  });
}

/** Coverage in percent with two decimals, rounded down so that it never reads 100 while a text is missing. */
export function progressOf(existing: number, total: number): number {
  if (total <= 0) return 0;
  return (
    Math.floor((existing / total) * PROGRESS_PRECISION_FACTOR) / FULL_PROGRESS
  );
}

function hasMissingLocale(
  localeMessages: LocaleMessages,
  path: string,
): boolean {
  return Object.values(localeMessages).some((messages) =>
    isMissing(getValueAtPath(messages, path)),
  );
}

/** The key tree of the matrix sidebar, flagging the branches holding a missing text. */
export function buildTree(
  keys: Record<string, unknown>,
  localeMessages: LocaleMessages,
  prefix = "",
): TreeItem[] {
  return Object.entries(keys).map(([key, value]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) {
      const hasMissing = leafPaths(value, fullPath).some((path) =>
        hasMissingLocale(localeMessages, path),
      );
      return {
        label: key,
        value: fullPath,
        children: buildTree(value, localeMessages, fullPath),
        defaultExpanded: false,
        trailingIcon: hasMissing ? MISSING_ICON : undefined,
      };
    }
    return {
      label: key,
      value: fullPath,
      trailingIcon: hasMissingLocale(localeMessages, fullPath)
        ? MISSING_ICON
        : undefined,
    };
  });
}

export function extractTranslationsByPath(
  messages: LocaleMessages,
  path: string,
): Record<string, TranslationValue> {
  const translations: Record<string, TranslationValue> = {};

  Object.entries(messages).forEach(([localeCode, localeMessages]) => {
    const value = getValueAtPath(localeMessages, path);
    translations[localeCode] = isMissing(value)
      ? undefined
      : (value as TranslationValue);
  });

  return translations;
}
