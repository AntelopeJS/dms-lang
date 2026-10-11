import { getTranslationConfig } from "./config";
import { fail } from "./errors";
import { getLocaleCodes, type OriginFilter } from "./registry";
import {
  DEFAULT_WORKSPACE,
  hasWorkspace,
  listWorkspaces,
  MODULES_WORKSPACE,
  normalizeWorkspaceId,
  type WorkspaceSummary,
} from "./workspaces";

/** The fallback locale of the DMS i18n config: the base language of the project files and the modules. */
export const FALLBACK_LOCALE = "en";

function localeEntries(codes: string[]) {
  return codes.map((code) => ({ code }));
}

function baseLocaleOf(origin: OriginFilter): string {
  const codes = getLocaleCodes(origin);
  return codes.includes(FALLBACK_LOCALE)
    ? FALLBACK_LOCALE
    : (codes[0] ?? FALLBACK_LOCALE);
}

/** The base language of the project files, decided by the server for every route. */
export function projectBaseLocale(): string {
  return baseLocaleOf("own");
}

/** The base language of the modules workspace. */
export function modulesBaseLocale(): string {
  return baseLocaleOf("external");
}

export function listAllWorkspaces(): WorkspaceSummary[] {
  const { editable } = getTranslationConfig();
  return [
    {
      id: DEFAULT_WORKSPACE,
      kind: "default",
      editable,
      defaultLocale: projectBaseLocale(),
      locales: localeEntries(getLocaleCodes("own")),
    },
    ...listWorkspaces(),
    {
      id: MODULES_WORKSPACE,
      kind: "modules",
      editable: false,
      defaultLocale: modulesBaseLocale(),
      locales: localeEntries(getLocaleCodes("external")),
    },
  ];
}

/**
 * The id of an existing workspace, lower-cased (ids are case-insensitive); an empty id is the
 * project files. 404 `unknown_workspace` without any disk path otherwise.
 */
export function resolveWorkspaceId(workspace: unknown): string {
  const id = normalizeWorkspaceId(workspace) || DEFAULT_WORKSPACE;
  if (id === DEFAULT_WORKSPACE || id === MODULES_WORKSPACE || hasWorkspace(id))
    return id;
  return fail(
    404,
    "unknown_workspace",
    `Unknown workspace: ${String(workspace)}`,
  );
}
