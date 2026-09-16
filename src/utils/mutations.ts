import { HTTPResult } from "@antelopejs/interface-api";
import { deleteOwnKey, renameOwnKey, upsertOwnKey } from "./own";
import { type WorkspaceKind, workspaceKind } from "./resolve";
import { deleteKey, renameKey, upsertKey } from "./workspaces";

interface KeyWriter {
  upsert(
    workspace: string,
    path: string,
    values: Record<string, unknown>,
    defaultLocale?: string,
  ): void;
  rename(workspace: string, path: string, newPath: string): void;
  remove(workspace: string, path: string): void;
}

function readOnly(): never {
  throw new HTTPResult(
    403,
    "The modules workspace is read-only; override into default",
  );
}

const KEY_WRITERS: Record<WorkspaceKind, KeyWriter> = {
  default: {
    upsert: (_workspace, path, values, defaultLocale) =>
      upsertOwnKey(path, values, defaultLocale),
    rename: (_workspace, path, newPath) => renameOwnKey(path, newPath),
    remove: (_workspace, path) => deleteOwnKey(path),
  },
  modules: { upsert: readOnly, rename: readOnly, remove: readOnly },
  added: {
    upsert: (workspace, path, values) => upsertKey(workspace, path, values),
    rename: (workspace, path, newPath) => renameKey(workspace, path, newPath),
    remove: (workspace, path) => deleteKey(workspace, path),
  },
};

export function upsertKeyFor(
  workspace: string,
  path: string,
  values: Record<string, unknown>,
  defaultLocale?: string,
): void {
  KEY_WRITERS[workspaceKind(workspace)].upsert(
    workspace,
    path,
    values,
    defaultLocale,
  );
}

export function renameKeyFor(
  workspace: string,
  path: string,
  newPath: string,
): void {
  KEY_WRITERS[workspaceKind(workspace)].rename(workspace, path, newPath);
}

export function deleteKeyFor(workspace: string, path: string): void {
  KEY_WRITERS[workspaceKind(workspace)].remove(workspace, path);
}
