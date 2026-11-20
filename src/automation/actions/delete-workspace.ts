import { z } from "zod";
import { deleteWorkspaceService } from "../../services/workspaces";
import { resolveWorkspaceId } from "../../utils/catalog";
import { resolveFlat } from "../../utils/resolve";
import { normalizeWorkspaceId } from "../../utils/workspaces";
import {
  MAX_WORKSPACE_LENGTH,
  NUMBER,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.delete-workspace";
const texts = nodeTexts("actions", ID);

const input = z.object({
  workspace: workspaceField,
  confirm: z.string().max(MAX_WORKSPACE_LENGTH),
});

export const deleteWorkspaceAction = writeAction({
  id: ID,
  icon: "i-ph-trash-simple",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      confirm: {
        type: "string",
        maxLength: MAX_WORKSPACE_LENGTH,
        description: texts.hint("confirm"),
      },
    },
    ["workspace", "confirm"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    locales: STRINGS,
    totalKeys: NUMBER,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    if (
      normalizeWorkspaceId(request.confirm) !==
      normalizeWorkspaceId(request.workspace)
    )
      throw new Error(
        `${ID}: confirm must repeat the translation workspace id "${normalizeWorkspaceId(request.workspace)}"; nothing was deleted (confirm_mismatch)`,
      );
    const flat = resolveFlat(resolveWorkspaceId(request.workspace));
    const workspace = deleteWorkspaceService(
      { id: request.workspace },
      writer,
      options,
    );
    return { workspace, locales: flat.locales, totalKeys: flat.totalKeys };
  },
});
