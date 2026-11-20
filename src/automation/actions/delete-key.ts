import { z } from "zod";
import { deleteKeyService } from "../../services/keys";
import { resolveWorkspaceId } from "../../utils/catalog";
import { currentText, hasLeaf, type KeyStore } from "../../utils/keys";
import { ownDefinitions } from "../../utils/registry";
import { resolveFlat, resolveRow } from "../../utils/resolve";
import { workspaceKind } from "../../utils/workspaces";
import {
  BOOLEAN,
  KEY_PORT,
  keyField,
  NUMBER,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { objectSchema, writeAction } from "../support";

const input = z.object({ workspace: workspaceField, key: keyField });

/** Whether the key still shows once the file that defines it loses it: a module or another project file has it. */
function staysVisible(
  workspace: string,
  store: KeyStore,
  key: string,
): boolean {
  const segments = key.split(".");
  if (hasLeaf(store.reference, segments)) return true;
  if (workspaceKind(workspace) !== "default") return false;
  return store.locales.some((locale) => ownDefinitions(locale, segments) > 1);
}

export const deleteKeyAction = writeAction({
  id: "lang.delete-key",
  icon: "i-ph-trash",
  inputSchema: objectSchema({ workspace: WORKSPACE_PORT, key: KEY_PORT }, [
    "workspace",
    "key",
  ]),
  outputSchema: objectSchema({
    workspace: STRING,
    key: STRING,
    locales: STRINGS,
    stillVisible: BOOLEAN,
    totalKeys: NUMBER,
  }),
  input,
  run(request, writer, options) {
    const before = resolveFlat(resolveWorkspaceId(request.workspace));
    const write = deleteKeyService(
      { workspace: request.workspace, path: request.key },
      writer,
      options,
    );
    const { store, workspace, key } = write;
    const stillVisible = options.dryRun
      ? staysVisible(workspace, store, key)
      : resolveRow(workspace, key) !== undefined;
    return {
      workspace,
      key,
      locales: store.locales.filter(
        (locale) => currentText(store.messages[locale], key) !== null,
      ),
      stillVisible,
      totalKeys: options.dryRun
        ? before.totalKeys - (stillVisible ? 0 : 1)
        : resolveFlat(workspace).totalKeys,
    };
  },
});
