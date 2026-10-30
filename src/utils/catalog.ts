import type { PageRecordLoader } from "@antelopejs/interface-dms/base/layouts";
import { getTranslationConfig } from "./config";
import { fail } from "./errors";
import { getLocaleCodes, type OriginFilter } from "./registry";
import {
  DEFAULT_WORKSPACE,
  hasWorkspace,
  listWorkspaces,
  MODULES_WORKSPACE,
  normalizeWorkspaceId,
  type WorkspaceLocale,
  type WorkspaceSummary,
} from "./workspaces";

/** The fallback locale of the DMS i18n config: the base language of the project files and the modules. */
export const FALLBACK_LOCALE = "en";

function localeEntries(codes: string[]): WorkspaceLocale[] {
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
export function resolveWorkspaceId(workspace?: string): string {
  const id = normalizeWorkspaceId(workspace) || DEFAULT_WORKSPACE;
  if (id === DEFAULT_WORKSPACE || id === MODULES_WORKSPACE || hasWorkspace(id))
    return id;
  return fail("unknown_workspace", { id: workspace });
}

/**
 * The summary of a workspace, by any id {@link resolveWorkspaceId} accepts (an empty id is the
 * project files); `undefined` when it does not exist.
 */
export function workspaceSummary(
  workspace?: string,
): WorkspaceSummary | undefined {
  const id = normalizeWorkspaceId(workspace) || DEFAULT_WORKSPACE;
  return listAllWorkspaces().find((entry) => entry.id === id);
}

/**
 * The workspace the workspace page shows, named by the `workspace` of its URL: a
 * tab on it leaves for the list once another deletes it.
 */
export const workspaceRecord: PageRecordLoader = ({ query }) => {
  const summary = workspaceSummary(query?.workspace);
  return summary && { ...summary };
};

/** The summary of an existing workspace, by any id {@link resolveWorkspaceId} accepts; 404 otherwise. */
export function findWorkspace(workspace?: string): WorkspaceSummary {
  const summary = workspaceSummary(workspace);
  if (summary === undefined) fail("unknown_workspace", { id: workspace });
  return summary;
}
