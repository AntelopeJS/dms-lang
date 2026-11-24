import { z } from "zod";
import { renameWorkspaceService } from "../../services/workspaces";
import { addedLocaleUrl, publicOrigin } from "../../utils/public-url";
import {
  MAX_WORKSPACE_LENGTH,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.rename-workspace";
const texts = nodeTexts("actions", ID);

const input = z.object({ workspace: workspaceField, newId: workspaceField });

export const renameWorkspaceAction = writeAction({
  id: ID,
  icon: "i-ph-textbox",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      newId: {
        type: "string",
        maxLength: MAX_WORKSPACE_LENGTH,
        description: texts.hint("newId"),
      },
    },
    ["workspace", "newId"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    previousWorkspace: STRING,
    publicUrl: STRING,
  }),
  input,
  async run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const renamed = renameWorkspaceService(
      { id: request.workspace, newId: request.newId },
      writer,
      options,
    );
    return {
      ...renamed,
      publicUrl: addedLocaleUrl(await publicOrigin(), renamed.workspace),
    };
  },
});
