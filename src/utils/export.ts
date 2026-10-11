import { projectBaseLocale, modulesBaseLocale } from "./catalog";
import { check } from "./errors";
import type { ImportInput } from "../validation/workspace.schema";
import { isPlainObject, validateKeyPath } from "./json";
import { findLocale, normalizeLocaleCode } from "./locale-codes";
import { getLocaleCodes, loadMessages } from "./registry";
import type { LocaleMessages } from "./tree";
import {
  getWorkspaceManifest,
  loadWorkspaceMessages,
  type WorkspaceDetails,
  type WorkspaceKind,
  type WorkspaceLocale,
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

function assertTexts(node: unknown, path: string, locale: string): void {
  if (typeof node === "string") return;
  check(isPlainObject(node), "invalid_value", { locale, path });
  for (const [key, child] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    validateKeyPath(childPath);
    assertTexts(child, childPath, locale);
  }
}

function importedLocales(backup: ImportInput): WorkspaceLocale[] {
  const declared =
    backup.locales ?? Object.keys(backup.messages).map((code) => ({ code }));
  const locales: WorkspaceLocale[] = [];
  for (const locale of declared) {
    const code = normalizeLocaleCode(locale.code);
    check(
      findLocale(
        locales.map((entry) => entry.code),
        code,
      ) === undefined,
      "locale_exists",
      { locale: code },
      "duplicate_locale",
    );
    locales.push({ ...locale, code });
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
    assertTexts(tree, "", locale);
    result[locale] = tree as Record<string, unknown>;
  }
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
