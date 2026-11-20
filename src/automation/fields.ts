import type { JsonSchema } from "@antelopejs/interface-dms-automation";
import { z } from "zod";
import { type FlatResult, isRowMissing } from "../utils/resolve";
import { coveragePercent } from "../utils/coverage";

export const MAX_WORKSPACE_LENGTH = 64;
export const MAX_KEY_LENGTH = 512;
export const MAX_LOCALE_LENGTH = 35;
export const MAX_TEXT_LENGTH = 10_000;
export const MAX_LIST_ITEMS = 100;

export const WORKSPACE_PORT: JsonSchema = {
  type: "string",
  maxLength: MAX_WORKSPACE_LENGTH,
  description: "$dms_lang.automation.hints.workspace",
};
export const KEY_PORT: JsonSchema = {
  type: "string",
  maxLength: MAX_KEY_LENGTH,
  description: "$dms_lang.automation.hints.key",
};
export const LOCALE_PORT: JsonSchema = {
  type: "string",
  maxLength: MAX_LOCALE_LENGTH,
  description: "$dms_lang.automation.hints.locale",
};
export const KEY_PREFIX_PORT: JsonSchema = {
  type: "string",
  maxLength: MAX_KEY_LENGTH,
  description: "$dms_lang.automation.hints.keyPrefix",
};
export const STRING: JsonSchema = { type: "string" };
export const NUMBER: JsonSchema = { type: "number" };
export const BOOLEAN: JsonSchema = { type: "boolean" };
export const STRINGS: JsonSchema = { type: "array", items: { type: "string" } };
export const OBJECT: JsonSchema = { type: "object" };

/** A translation workspace a write targets: required. */
export const workspaceField = z
  .string()
  .trim()
  .min(1)
  .max(MAX_WORKSPACE_LENGTH);
/** A translation workspace a read targets: empty is the project files. */
export const readWorkspaceField = z
  .string()
  .trim()
  .max(MAX_WORKSPACE_LENGTH)
  .optional()
  .transform((value) => value || "default");
export const keyField = z.string().min(1).max(MAX_KEY_LENGTH);
export const localeField = z.string().trim().min(1).max(MAX_LOCALE_LENGTH);
export const optionalLocaleField = z
  .string()
  .trim()
  .max(MAX_LOCALE_LENGTH)
  .optional()
  .transform((value) => value ?? "");
export const keyPrefixField = z
  .string()
  .max(MAX_KEY_LENGTH)
  .optional()
  .transform((value) => value ?? "");
export const localesField = z
  .array(z.string().max(MAX_LOCALE_LENGTH))
  .max(MAX_LIST_ITEMS)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

/** Whether a key is `prefix` or under it as a namespace; every key when the prefix is empty. */
export function matchesPrefix(key: string, prefix: string): boolean {
  return prefix === "" || key === prefix || key.startsWith(`${prefix}.`);
}

export interface LocaleFigures {
  coverage: number;
  missing: number;
}

/** The coverage of a language, after a write that changes its missing count by `missingDelta` and its keys by `keysDelta`. */
export function figuresOf(
  flat: FlatResult,
  locale: string,
  missingDelta = 0,
  keysDelta = 0,
): LocaleFigures {
  const total = flat.totalKeys + keysDelta;
  const missing = (flat.localeMissing[locale] ?? 0) + missingDelta;
  return { coverage: coveragePercent(total - missing, total), missing };
}

/** Whether a key has no text in a language, as the figures count it; a key not there counts as not missing. */
export function rowMissing(
  flat: FlatResult,
  key: string,
  locale: string,
): boolean {
  const row = flat.rows.find((entry) => entry.key === key);
  return row !== undefined && isRowMissing(row, locale);
}
