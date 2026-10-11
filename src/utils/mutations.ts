import { fail } from "./errors";
import {
  createKey,
  deleteKey,
  type KeyStore,
  type LocaleTexts,
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
  return fail("read_only", {}, "modules_read_only");
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
  path: string,
  values: LocaleTexts,
  before?: string | null,
): void {
  createKey(storeOf(workspace), path, values, before);
}

export function updateKeyFor(
  workspace: string,
  path: string,
  values: LocaleTexts,
  expected?: LocaleTexts,
): void {
  updateKey(storeOf(workspace), path, values, expected);
}

export function renameKeyFor(
  workspace: string,
  path: string,
  newPath: string,
): string {
  return renameKey(storeOf(workspace), path, newPath);
}

export function deleteKeyFor(workspace: string, path: string): void {
  deleteKey(storeOf(workspace), path);
}

export function removeOverrideFor(
  workspace: string,
  path: string,
  locales?: string[],
): void {
  if (workspaceKind(workspace) !== "default")
    fail("not_an_override", { path }, "override_project_only");
  removeOverride(storeOf(workspace), path, locales);
}
