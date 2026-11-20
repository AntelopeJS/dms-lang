import fs, { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isString } from "../../utils/guards";
import { isJsonObject, isJsonValue, type JsonValue } from "../../utils/json";
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

/** Every file of a folder with its text: equal before and after a step means it wrote nothing there. */
export function folderContents(folder: string): Record<string, string> {
  let names: string[];
  try {
    names = readdirSync(folder).sort();
  } catch {
    return {};
  }
  return Object.fromEntries(
    names.map((name) => [name, readText(join(folder, name))]),
  );
}

/** Runs `work` while any file read fails, so a test sees that it reads none. */
export function withoutFileReads<T>(work: () => T): T {
  const read = fs.readFileSync;
  fs.readFileSync = () => {
    throw new Error("a file was read");
  };
  try {
    return work();
  } finally {
    fs.readFileSync = read;
  }
}

function leafKeys(value: JsonValue, prefix: string): string[] {
  if (!isJsonObject(value)) return isString(value) ? [prefix] : [];
  return Object.entries(value).flatMap(([name, child]) =>
    leafKeys(child, prefix ? `${prefix}.${name}` : name),
  );
}

/** The keys of a frontend locale file that hold a text. */
export function localeTextKeys(file: string): Set<string> {
  return new Set(
    leafKeys(
      readJson(join(__dirname, "../../../frontend-vue/i18n/locales", file)),
      "",
    ),
  );
}
