import { resolveWorkspaceId } from "../utils/catalog";
import { type PreparedImport, prepareImport } from "../utils/export";
import {
  type AddedLocale,
  addLocale,
  assertEditable,
  checkAddLocale,
  checkBaseLocale,
  checkNewWorkspace,
  checkRemoveLocale,
  checkWorkspace,
  createWorkspace,
  deleteWorkspace,
  type DetailsInput,
  getWorkspaceSummary,
  removeLocale,
  renameWorkspace,
  setWorkspaceDefaultLocale,
  updateWorkspaceDetails,
  validateLocaleEntry,
  type WorkspaceLocale,
  type WorkspaceSummary,
  writeNewWorkspace,
} from "../utils/workspaces";
import type { ImportInput } from "../validation/workspace.schema";
import {
  announceWrite,
  recordChange,
  type WriteOptions,
  type Writer,
} from "./writer";

export interface CreateWorkspaceRequest {
  id: string;
  locale: WorkspaceLocale;
  details?: DetailsInput;
}

export interface CreatedWorkspace {
  workspace: string;
  baseLocale: string;
}

/** Creates an added workspace; answers its id and base language. */
export function createWorkspaceService(
  request: CreateWorkspaceRequest,
  writer: Writer,
  options: WriteOptions = {},
): CreatedWorkspace {
  assertEditable();
  const baseLocale = validateLocaleEntry(request.locale).code;
  if (options.dryRun)
    return { workspace: checkNewWorkspace(request.id), baseLocale };
  const workspace = createWorkspace(
    request.id,
    request.locale,
    request.details,
  );
  announceWrite(writer, workspace);
  recordChange(writer, workspace, "workspace-created", {
    locales: [baseLocale],
  });
  return { workspace, baseLocale };
}

function cleaned(value?: string | null): string | undefined {
  return value?.trim() || undefined;
}

/** Changes the description and type of an added workspace: an absent field is kept, an empty one cleared. */
export function updateWorkspaceService(
  request: { id: string; details: DetailsInput },
  writer: Writer,
  options: WriteOptions = {},
): WorkspaceSummary {
  assertEditable();
  if (options.dryRun) {
    const summary = getWorkspaceSummary(checkWorkspace(request.id));
    const { description, type, ...rest } = summary;
    const next: WorkspaceSummary = { ...rest };
    const nextDescription =
      "description" in request.details
        ? cleaned(request.details.description)
        : description;
    const nextType =
      "type" in request.details ? request.details.type || undefined : type;
    if (nextDescription !== undefined) next.description = nextDescription;
    if (nextType !== undefined && nextType !== null) next.type = nextType;
    return next;
  }
  const summary = updateWorkspaceDetails(request.id, request.details);
  announceWrite(writer, summary.id);
  recordChange(writer, summary.id, "workspace-updated");
  return summary;
}

export interface RenamedWorkspace {
  workspace: string;
  previousWorkspace: string;
}

/** Renames an added workspace; answers the new id and the previous one. */
export function renameWorkspaceService(
  request: { id: string; newId: string },
  writer: Writer,
  options: WriteOptions = {},
): RenamedWorkspace {
  assertEditable();
  const previousWorkspace = checkWorkspace(request.id);
  if (options.dryRun)
    return { workspace: checkNewWorkspace(request.newId), previousWorkspace };
  const workspace = renameWorkspace(request.id, request.newId);
  announceWrite(writer, previousWorkspace);
  announceWrite(writer, workspace);
  recordChange(writer, workspace, "workspace-renamed", { previousWorkspace });
  return { workspace, previousWorkspace };
}

/** Deletes an added workspace with its files; answers its id. */
export function deleteWorkspaceService(
  request: { id: string },
  writer: Writer,
  options: WriteOptions = {},
): string {
  assertEditable();
  const id = checkWorkspace(request.id);
  if (options.dryRun) return id;
  const locales = getWorkspaceSummary(id).locales.map((locale) => locale.code);
  deleteWorkspace(id);
  announceWrite(writer, id);
  recordChange(writer, id, "workspace-deleted", { locales });
  return id;
}

/** Creates an added workspace from a backup; answers what it holds. */
export function importWorkspaceService(
  backup: ImportInput,
  writer: Writer,
  options: WriteOptions = {},
): PreparedImport {
  assertEditable();
  const prepared = prepareImport(backup);
  if (options.dryRun) return prepared;
  const id = writeNewWorkspace(prepared.id, prepared.seed);
  announceWrite(writer, id);
  recordChange(writer, id, "workspace-imported", {
    locales: prepared.seed.locales.map((locale) => locale.code),
  });
  return { ...prepared, id };
}

export interface LanguageRequest {
  workspace: string;
  code: string;
}

export function addLanguageService(
  request: { workspace: string; locale: WorkspaceLocale },
  writer: Writer,
  options: WriteOptions = {},
): AddedLocale & { workspace: string } {
  assertEditable();
  const id = resolveWorkspaceId(request.workspace);
  if (options.dryRun)
    return { ...checkAddLocale(id, request.locale), workspace: id };
  const added = addLocale(id, request.locale);
  announceWrite(writer, id);
  recordChange(writer, id, "language-added", { locales: [added.code] });
  return { ...added, workspace: id };
}

export function removeLanguageService(
  request: LanguageRequest,
  writer: Writer,
  options: WriteOptions = {},
): LanguageRequest {
  assertEditable();
  const id = resolveWorkspaceId(request.workspace);
  const code = checkRemoveLocale(id, request.code);
  if (options.dryRun) return { workspace: id, code };
  removeLocale(id, code);
  announceWrite(writer, id);
  recordChange(writer, id, "language-removed", { locales: [code] });
  return { workspace: id, code };
}

export interface BaseLanguageChange {
  workspace: string;
  baseLocale: string;
  previousBaseLocale: string;
}

export function setBaseLanguageService(
  request: LanguageRequest,
  writer: Writer,
  options: WriteOptions = {},
): BaseLanguageChange {
  assertEditable();
  const id = resolveWorkspaceId(request.workspace);
  const { stored, previous } = checkBaseLocale(id, request.code);
  const result = {
    workspace: id,
    baseLocale: stored,
    previousBaseLocale: previous,
  };
  if (options.dryRun) return result;
  setWorkspaceDefaultLocale(id, stored);
  announceWrite(writer, id);
  recordChange(writer, id, "base-language-changed");
  return result;
}
