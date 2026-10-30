import { readFileSync } from "node:fs";
import { isJsonValue, type JsonValue } from "../../utils/json";

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
