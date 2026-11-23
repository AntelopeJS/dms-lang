import { z } from "zod";
import { deleteKeyService } from "../../services/keys";
import { resolveWorkspaceId } from "../../utils/catalog";
import { currentText, hasLeaf, type KeyStore } from "../../utils/keys";
import { ownDefinitions } from "../../utils/registry";
import { keyStoreOf } from "../../utils/key-stores";
import { resolveFlat } from "../../utils/resolve";
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

/** Whether another project file still defines the key once the file it is written to loses it. */
function definedElsewhere(
  workspace: string,
  store: KeyStore,
  key: string,
): boolean {
  if (workspaceKind(workspace) !== "default") return false;
  const segments = key.split(".");
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
    const workspace = resolveWorkspaceId(request.workspace);
    const before = resolveFlat(workspace);
    const preview = keyStoreOf(workspace);
    const elsewhere = definedElsewhere(workspace, preview, request.key);
    const stillVisible =
      elsewhere || hasLeaf(preview.reference, request.key.split("."));
    const write = deleteKeyService(
      { workspace: request.workspace, path: request.key },
      writer,
      options,
    );
    const { store, key } = write;
    return {
      workspace,
      key,
      locales: store.locales.filter(
        (locale) => currentText(store.messages[locale], key) !== null,
      ),
      stillVisible,
      totalKeys: options.dryRun
        ? before.totalKeys - (elsewhere ? 0 : 1)
        : resolveFlat(workspace).totalKeys,
    };
  },
});
