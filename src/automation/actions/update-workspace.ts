import { z } from "zod";
import { updateWorkspaceService } from "../../services/workspaces";
import type { DetailsInput } from "../../utils/workspaces";
import { WORKSPACE_TYPES } from "../../utils/workspaces";
import { STRING, WORKSPACE_PORT, workspaceField } from "../fields";
import { assertAdded, nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.update-workspace";
const texts = nodeTexts("actions", ID);
const MAX_DESCRIPTION_LENGTH = 500;

const input = z.object({
  workspace: workspaceField,
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  type: z.enum(WORKSPACE_TYPES).or(z.literal("")).optional(),
});

export const updateWorkspaceAction = writeAction({
  id: ID,
  icon: "i-ph-note-pencil",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      description: {
        type: "string",
        maxLength: MAX_DESCRIPTION_LENGTH,
        description: texts.hint("description"),
      },
      type: {
        type: "string",
        enum: [...WORKSPACE_TYPES, ""],
        description: texts.hint("type"),
      },
    },
    ["workspace"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    description: STRING,
    type: STRING,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const details: DetailsInput = {};
    if (request.description !== undefined)
      details.description = request.description;
    if (request.type !== undefined) details.type = request.type;
    const summary = updateWorkspaceService(
      { id: request.workspace, details },
      writer,
      options,
    );
    return {
      workspace: summary.id,
      description: summary.description ?? "",
      type: summary.type ?? "",
    };
  },
});
