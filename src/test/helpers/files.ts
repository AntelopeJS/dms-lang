import { readFileSync } from "node:fs";

/** A language file as a test writes it: texts, under namespaces. */
export interface LocaleTree {
  [key: string]: string | LocaleTree;
}

/** The text of a file the module wrote. */
export function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

/** The JSON value of a file the module wrote. */
export function readJson(path: string): unknown {
  return JSON.parse(readText(path));
}
