import { projectBaseLocale, modulesBaseLocale } from "./catalog";
import { check } from "./errors";
import type { ImportInput } from "../validation/workspace.schema";
import {
  isPlainObject,
  leafPrefixOf,
  nodeKindAt,
  validateKeyPath,
} from "./json";
import { assertMessageSyntax } from "./message-syntax";
import { findLocale } from "./locale-codes";
import { getLocaleCodes, loadMessages } from "./registry";
import { leafPaths, type LocaleMessages } from "./tree";
import {
  getWorkspaceManifest,
  loadWorkspaceMessages,
  type WorkspaceDetails,
  type WorkspaceKind,
  type WorkspaceLocale,
  validateLocaleEntry,
  workspaceKind,
  writeNewWorkspace,
} from "./workspaces";

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

interface BackupSource extends WorkspaceDetails {
  defaultLocale: string;
  locales: WorkspaceLocale[];
  messages: LocaleMessages;
}

const EXPORTERS: Record<WorkspaceKind, (workspace: string) => LocaleMessages> =
  {
    default: () => loadMessages("own"),
    modules: () => loadMessages("external"),
    added: (workspace) => loadWorkspaceMessages(workspace),
  };

export function exportWorkspace(workspace: string): LocaleMessages {
  return EXPORTERS[workspaceKind(workspace)](workspace);
}

function codeEntries(codes: string[]): WorkspaceLocale[] {
  return codes.map((code) => ({ code }));
}

const BACKUP_SOURCES: Record<
  WorkspaceKind,
  (workspace: string) => BackupSource
> = {
  default: () => ({
    defaultLocale: projectBaseLocale(),
    locales: codeEntries(getLocaleCodes("own")),
    messages: loadMessages("own"),
  }),
  modules: () => ({
    defaultLocale: modulesBaseLocale(),
    locales: codeEntries(getLocaleCodes("external")),
    messages: loadMessages("external"),
  }),
  added: (workspace) => {
    const { defaultLocale, locales, description, type } =
      getWorkspaceManifest(workspace);
    return {
      defaultLocale,
      locales,
      description,
      type,
      messages: loadWorkspaceMessages(workspace),
    };
  },
};

/** Everything needed to recreate a workspace: its languages, its base, its details and its texts. */
export function backupWorkspace(workspace: string): WorkspaceBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    id: workspace,
    ...BACKUP_SOURCES[workspaceKind(workspace)](workspace),
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
function cleanTree(node: unknown, at: TreeLocation): unknown {
  if (typeof node === "string") {
    if (node.trim() === "") return undefined;
    assertMessageSyntax(at.locale, node);
    return node;
  }
  check(isPlainObject(node), "invalid_value", {
    locale: at.locale,
    path: at.segments.join("."),
  });
  const entries = Object.entries(node)
    .map(([key, child]) => [key, cleanTree(child, childLocation(at, key))])
    .filter(([, child]) => child !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function cleanMessages(locale: string, tree: unknown): Record<string, unknown> {
  const cleaned = cleanTree(tree, { locale, segments: [] });
  return isPlainObject(cleaned) ? cleaned : {};
}

/** A key of one language that is a namespace, or under a key, in another: what `PUT /key` refuses. */
function clashOf(messages: LocaleMessages, path: string): string | undefined {
  const segments = path.split(".");
  return Object.values(messages)
    .map((data) =>
      nodeKindAt(data, segments) === "branch"
        ? path
        : leafPrefixOf(data, segments),
    )
    .find((clash) => clash !== undefined);
}

function assertNoClash(messages: LocaleMessages): void {
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
  messages: Record<string, unknown>,
  locales: WorkspaceLocale[],
): LocaleMessages {
  const result: LocaleMessages = {};
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
