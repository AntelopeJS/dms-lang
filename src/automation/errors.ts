import { HTTPResult } from "@antelopejs/interface-api";
import { isString } from "../utils/guards";
import { isJsonObject, isJsonValue, type JsonObject } from "../utils/json";

type Details = JsonObject;

function detail(details: Details, field: string) {
  return Object.hasOwn(details, field) ? details[field] : undefined;
}

function named(details: Details, field: string): string {
  const value = detail(details, field);
  if (isString(value)) return `"${value}"`;
  if (Array.isArray(value))
    return value.map((item) => JSON.stringify(item)).join(", ");
  return "";
}

/** How a run shows each reason a Lang write or read is refused, in English. */
const SENTENCES = new Map<string, (details: Details) => string>(
  Object.entries({
    invalid_body: () => "the input is not valid",
    invalid_key_path: (d) => `${named(d, "path")} is not a valid key path`,
    invalid_new_key_path: (d) =>
      `${named(d, "path")} is not a valid new key path: letters, digits, _ and -, at most 128 characters per segment`,
    same_key_path: () => "the new key path is the current one",
    invalid_before: (d) => `${named(d, "before")} is not a sibling of the key`,
    invalid_value: (d) => `the text of ${named(d, "path")} is not a text`,
    empty_key: (d) => `key ${named(d, "path")} needs at least one text`,
    invalid_message: (d) =>
      detail(d, "keys") === undefined
        ? `the text in ${named(d, "locale")} is not a valid message (${named(d, "problems")})`
        : `these texts in ${named(d, "locale")} are not valid messages: ${named(d, "keys")}`,
    invalid_locale: (d) => `${named(d, "locale")} is not a known language code`,
    undeclared_locale: (d) =>
      `language ${named(d, "locale")} is not a language of the translation workspace`,
    no_project_file: (d) =>
      `the project has no language file for ${named(d, "locale")}`,
    invalid_workspace_id: (d) =>
      `${named(d, "id")} is not a valid translation workspace id: lower-case letters, digits, _ and -, at most 64 characters`,
    reserved_workspace: (d) =>
      `${named(d, "id")} is a reserved translation workspace id`,
    not_a_key: (d) => `${named(d, "path")} is a namespace, not a key`,
    read_only: () => "Lang editing is off on this process (editable: false)",
    modules_read_only: () => "the modules translation workspace is read-only",
    review_added_only: () =>
      "review tracking exists in added translation workspaces only",
    unknown_workspace: (d) =>
      `translation workspace ${named(d, "id")} not found`,
    unknown_locale: (d) =>
      `language ${named(d, "locale")} not found in the translation workspace`,
    key_not_found: (d) => `key ${named(d, "path")} not found`,
    module_key_locked: (d) =>
      `key ${named(d, "path")} comes from a module and cannot be renamed or deleted here`,
    not_an_override: (d) =>
      `key ${named(d, "path")} does not override a module text`,
    conflict: (d) =>
      `the text of ${named(d, "path")} changed since it was read`,
    key_exists: (d) => `key ${named(d, "path")} already exists`,
    key_conflict: (d) =>
      `key ${named(d, "path")} clashes with ${named(d, "conflicts")}`,
    module_key: (d) => `a module already has key ${named(d, "path")}`,
    last_value: (d) =>
      detail(d, "keys") === undefined
        ? `the last text of key ${named(d, "path")} cannot be cleared`
        : `the last text of these keys cannot be cleared: ${named(d, "keys")}`,
    workspace_exists: (d) =>
      `translation workspace ${named(d, "id")} already exists`,
    locale_exists: (d) => `language ${named(d, "locale")} already exists`,
    duplicate_locale: (d) => `language ${named(d, "locale")} is listed twice`,
    unknown_base_locale: (d) =>
      `base language ${named(d, "locale")} is not a language of the backup`,
    no_locale: () => "the backup has no language",
    base_locale: (d) => `${named(d, "locale")} is the base language`,
    invalid_backup: () => "this is not a translation workspace backup",
    newer_backup: () => "the backup was made by a newer version of Lang",
    corrupt_file: (d) => `language file ${named(d, "file")} is not valid JSON`,
    corrupt_manifest: () =>
      "the translation workspace manifest is not valid JSON",
    not_configured: () => "workspacesDir is not configured",
  }),
);

function bodyOf(result: HTTPResult): Details {
  try {
    const parsed: unknown = JSON.parse(result.getBody());
    return isJsonValue(parsed) && isJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The error a step fails with for what a Lang utility threw: a refusal
 * (`HTTPResult`) becomes a readable English message ending with its stable
 * code, e.g. `Lang: key "a.b" not found (key_not_found)`.
 */
export function stepError(error: Error | HTTPResult, nodeId?: string): Error {
  if (!(error instanceof HTTPResult)) return error;
  const details = bodyOf(error);
  const rawCode = detail(details, "code");
  const message = detail(details, "message");
  const code = isString(rawCode) ? rawCode : "server_error";
  const reason = isString(message) ? (message.split(".").at(-1) ?? code) : code;
  const sentence =
    SENTENCES.get(reason)?.(details) ?? reason.replaceAll("_", " ");
  if (code === "read_only" && reason === "read_only" && nodeId !== undefined)
    return new Error(
      `Lang editing is off on this process (editable: false); ${nodeId} writes nothing here (read_only)`,
    );
  return new Error(`Lang: ${sentence} (${code})`);
}
