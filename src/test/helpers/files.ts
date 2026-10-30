import { readFileSync } from "node:fs";
import { isJsonValue, type JsonValue } from "../../utils/json";
import type { LocaleMessages } from "../../utils/tree";

/** A language file as a test writes it: texts, under namespaces. */
export interface LocaleTree {
  [key: string]: string | LocaleTree;
}

/** The text of a file the module wrote. */
export function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

/** The JSON value of a file the module wrote. */
export function readJson(path: string): JsonValue {
  const parsed: unknown = JSON.parse(readText(path));
  if (isJsonValue(parsed)) return parsed;
  throw new TypeError(`${path} does not hold JSON values only`);
}

/** The texts of a backup as an import takes them: JSON values only. */
export function jsonTrees(messages: LocaleMessages): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(messages).map(([locale, tree]): [string, JsonValue] => {
      if (isJsonValue(tree)) return [locale, tree];
      throw new TypeError(`the ${locale} messages are not JSON values only`);
    }),
  );
}
