import { projectBaseLocale, modulesBaseLocale } from "./catalog";
import { check } from "./errors";
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
  check(
    isPlainObject(node),
    400,
    "invalid_value",
    `The ${locale} value of ${path || "the file"} must be a text or an object of texts`,
  );
  for (const [key, child] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    validateKeyPath(childPath);
    assertTexts(child, childPath, locale);
  }
}

function importedLocales(
  body: Record<string, unknown>,
  messages: Record<string, unknown>,
): WorkspaceLocale[] {
  const declared = Array.isArray(body.locales)
    ? (body.locales as WorkspaceLocale[])
    : Object.keys(messages).map((code) => ({ code }));
  const locales: WorkspaceLocale[] = [];
  for (const locale of declared) {
    const code = normalizeLocaleCode(locale?.code);
    check(
      findLocale(
        locales.map((entry) => entry.code),
        code,
      ) === undefined,
      409,
      "locale_exists",
      `The backup lists ${code} twice`,
    );
    locales.push({ ...locale, code });
  }
  check(locales.length > 0, 400, "invalid_body", "The backup has no language");
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
    check(
      locale !== undefined,
      400,
      "unknown_locale",
      `The backup has texts for an undeclared language: ${code}`,
    );
    assertTexts(tree, "", locale);
    result[locale] = tree as Record<string, unknown>;
  }
  return result;
}

/**
 * Creates an added workspace from a backup (or from an older export `{ <locale>: messages }`
 * passed as `messages`). Returns the id of the new workspace.
 */
export function importWorkspace(body: Record<string, unknown>): string {
  check(
    isPlainObject(body.messages),
    400,
    "invalid_body",
    "Missing field: messages",
  );
  const messages = body.messages;
  const locales = importedLocales(body, messages);
  const codes = locales.map((locale) => locale.code);
  const base =
    typeof body.defaultLocale === "string"
      ? findLocale(codes, body.defaultLocale)
      : codes[0];
  check(
    base !== undefined,
    400,
    "unknown_locale",
    "The base language is not one of the backup languages",
  );
  return writeNewWorkspace(body.id, {
    defaultLocale: base,
    locales,
    messages: importedMessages(messages, locales),
    description: body.description as string | undefined,
    type: body.type as WorkspaceDetails["type"],
  });
}
