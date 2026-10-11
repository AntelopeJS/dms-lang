import { fail } from "./errors";
import {
  createKey,
  deleteKey,
  type KeyStore,
  removeOverride,
  renameKey,
  updateKey,
} from "./keys";
import { ownKeyStore } from "./own";
import { trackSources } from "./review";
import {
  type WorkspaceKind,
  workspaceKeyStore,
  workspaceKind,
} from "./workspaces";

function readOnly(): never {
  return fail(
    403,
    "read_only",
    "The modules workspace is read-only; override its keys in the project files",
  );
}

const KEY_STORES: Record<WorkspaceKind, (workspace: string) => KeyStore> = {
  default: () => ownKeyStore(),
  modules: readOnly,
  added: (workspace) => trackSources(workspaceKeyStore(workspace), workspace),
};

function storeOf(workspace: string): KeyStore {
  return KEY_STORES[workspaceKind(workspace)](workspace);
}

export function createKeyFor(
  workspace: string,
  path: unknown,
  values: unknown,
  before?: unknown,
): void {
  createKey(storeOf(workspace), path, values, before);
}

export function updateKeyFor(
  workspace: string,
  path: unknown,
  values: unknown,
  expected?: unknown,
): void {
  updateKey(storeOf(workspace), path, values, expected);
}

export function renameKeyFor(
  workspace: string,
  path: unknown,
  newPath: unknown,
): string {
  return renameKey(storeOf(workspace), path, newPath);
}

export function deleteKeyFor(workspace: string, path: unknown): void {
  deleteKey(storeOf(workspace), path);
}

export function removeOverrideFor(
  workspace: string,
  path: unknown,
  locales?: unknown,
): void {
  if (workspaceKind(workspace) !== "default")
    fail(400, "not_an_override", "Only the project files override module keys");
  removeOverride(storeOf(workspace), path, locales);
}
