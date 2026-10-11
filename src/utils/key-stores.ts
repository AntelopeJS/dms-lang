import { check, fail } from "./errors";
import type { KeyStore } from "./keys";
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

/**
 * The key store a write to a workspace goes through: the project files over
 * the modules, an added workspace with its review tracking; the modules
 * workspace is read-only (403).
 */
export function keyStoreOf(workspace: string): KeyStore {
  return KEY_STORES[workspaceKind(workspace)](workspace);
}

/** The key store of an added workspace, the only kind whose translations are tracked for review; 400 otherwise. */
export function reviewStoreOf(workspace: string): KeyStore {
  check(
    workspaceKind(workspace) === "added",
    "invalid_body",
    { workspace },
    "review_added_only",
  );
  return keyStoreOf(workspace);
}
