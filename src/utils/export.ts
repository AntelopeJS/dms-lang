import { findWorkspace } from "./catalog";
import { check, fail } from "./errors";
import type { ImportInput } from "../validation/workspace.schema";
import {
  isJsonObject,
  isPlainObject,
  type JsonObject,
  leafPrefixOf,
  nodeKindAt,
  validateKeyPath,
} from "./json";
import { assertMessageSyntax } from "./message-syntax";
import { findLocale } from "./locale-codes";
import { loadMessages } from "./registry";
import { leafPaths, type LocaleMessages, type LocaleTrees } from "./tree";
import {
  loadWorkspaceMessages,
  type WorkspaceDetails,
  type WorkspaceKind,
  type WorkspaceLocale,
  validateLocaleEntry,
  workspaceKind,
  writeNewWorkspace,
} from "./workspaces";
import { isString } from "./guards";

export const BACKUP_FORMAT = "dms-lang.workspace";
export const BACKUP_VERSION = 1;

export interface WorkspaceBackup extends WorkspaceDetails {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  id: string;
  defaultLocale: string;
  locales: WorkspaceLocale[];
  messages: LocaleMessages;
}

const EXPORTERS: Record<WorkspaceKind, (workspace: string) => LocaleTrees> = {
  default: () => loadMessages("own"),
  modules: () => loadMessages("external"),
  added: (workspace) => loadWorkspaceMessages(workspace),
};

export function exportWorkspace(workspace: string): LocaleTrees {
  return EXPORTERS[workspaceKind(workspace)](workspace);
}

/** The texts of one language of a workspace, as its language file holds them; 404 when it has no such language. */
export function exportLanguage(
  workspace: string,
  code: string,
): Record<string, unknown> {
  const messages = exportWorkspace(workspace);
  const found = findLocale(Object.keys(messages), code);
  if (found === undefined) fail("unknown_locale", { locale: code });
  return messages[found] ?? {};
}

/** Everything needed to recreate a workspace: its languages, its base, its details and its texts. */
export function backupWorkspace(workspace: string): WorkspaceBackup {
  const { id, defaultLocale, locales, description, type } =
    findWorkspace(workspace);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    id,
    defaultLocale,
    locales,
    description,
    type,
    messages: exportWorkspace(id),
  };
}

interface TreeLocation {
  locale: string;
  segments: string[];
}

function childLocation(at: TreeLocation, key: string): TreeLocation {
  const segments = [...at.segments, key];
  check(validateKeyPath(key).length === 1, "invalid_key_path", {
    path: segments.join("."),
  });
  return { locale: at.locale, segments };
}

/**
 * The texts of a backup as `PUT /key` would write them: each one a message
 * vue-i18n compiles, an empty text left out (and the namespace it empties).
 */
function cleanTree(
  node: unknown,
  at: TreeLocation,
): string | JsonObject | undefined {
  if (isString(node)) {
    if (node.trim() === "") return undefined;
    assertMessageSyntax(at.locale, node);
    return node;
  }
  check(isPlainObject(node), "invalid_value", {
    locale: at.locale,
    path: at.segments.join("."),
  });
  const entries = Object.entries(node).flatMap(
    ([key, child]): [string, string | JsonObject][] => {
      const cleaned = cleanTree(child, childLocation(at, key));
      return cleaned === undefined ? [] : [[key, cleaned]];
    },
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function cleanMessages(locale: string, tree: unknown): JsonObject {
  const cleaned = cleanTree(tree, { locale, segments: [] });
  return isJsonObject(cleaned) ? cleaned : {};
}

/** A key of one language that is a namespace, or under a key, in another: what `PUT /key` refuses. */
function clashOf(messages: LocaleTrees, path: string): string | undefined {
  const segments = path.split(".");
  return Object.values(messages)
    .map((data) =>
      nodeKindAt(data, segments) === "branch"
        ? path
        : leafPrefixOf(data, segments),
    )
    .find((clash) => clash !== undefined);
}

function assertNoClash(messages: LocaleTrees): void {
  for (const [locale, data] of Object.entries(messages)) {
    for (const path of leafPaths(data)) {
      const clash = clashOf(messages, path);
      check(clash === undefined, "key_conflict", {
        path,
        locale,
        conflicts: [clash],
      });
    }
  }
}

function importedLocales(backup: ImportInput): WorkspaceLocale[] {
  const declared =
    backup.locales ?? Object.keys(backup.messages).map((code) => ({ code }));
  const locales: WorkspaceLocale[] = [];
  for (const locale of declared) {
    const entry = validateLocaleEntry(locale);
    check(
      findLocale(
        locales.map((known) => known.code),
        entry.code,
      ) === undefined,
      "locale_exists",
      { locale: entry.code },
      "duplicate_locale",
    );
    locales.push(entry);
  }
  check(locales.length > 0, "invalid_body", {}, "no_locale");
  return locales;
}

function importedMessages(
  messages: ImportInput["messages"],
  locales: WorkspaceLocale[],
): LocaleTrees {
  const result: LocaleTrees = {};
  for (const [code, tree] of Object.entries(messages)) {
    const locale = findLocale(
      locales.map((entry) => entry.code),
      code,
    );
    check(locale !== undefined, "undeclared_locale", { locale: code });
    result[locale] = cleanMessages(locale, tree);
  }
  assertNoClash(result);
  return result;
}

/**
 * Creates an added workspace from a backup (or from an older export `{ <locale>: messages }`
 * passed as `messages`). Returns the id of the new workspace.
 */
export function importWorkspace(backup: ImportInput): string {
  const locales = importedLocales(backup);
  const codes = locales.map((locale) => locale.code);
  const base =
    backup.defaultLocale === undefined
      ? codes[0]
      : findLocale(codes, backup.defaultLocale);
  check(
    base !== undefined,
    "undeclared_locale",
    { locale: backup.defaultLocale },
    "unknown_base_locale",
  );
  return writeNewWorkspace(backup.id, {
    defaultLocale: base,
    locales,
    messages: importedMessages(backup.messages, locales),
    description: backup.description,
    type: backup.type,
  });
}
