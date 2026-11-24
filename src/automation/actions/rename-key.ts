import { z } from "zod";
import { renameKeyService } from "../../services/keys";
import {
  KEY_PORT,
  keyField,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { objectSchema, writeAction } from "../support";

const input = z.object({
  workspace: workspaceField,
  key: keyField,
  newKey: keyField,
});

export const renameKeyAction = writeAction({
  id: "lang.rename-key",
  icon: "i-ph-arrow-right",
  inputSchema: objectSchema(
    { workspace: WORKSPACE_PORT, key: KEY_PORT, newKey: KEY_PORT },
    ["workspace", "key", "newKey"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    key: STRING,
    previousKey: STRING,
  }),
  input,
  run(request, writer, options) {
    const write = renameKeyService(
      {
        workspace: request.workspace,
        path: request.key,
        newPath: request.newKey,
      },
      writer,
      options,
    );
    return {
      workspace: write.workspace,
      key: write.key,
      previousKey: request.key,
    };
  },
});
