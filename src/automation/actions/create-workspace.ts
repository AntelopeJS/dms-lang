import { z } from "zod";
import { createWorkspaceService } from "../../services/workspaces";
import { addedLocaleUrl, publicOrigin } from "../../utils/public-url";
import { WORKSPACE_TYPES } from "../../utils/workspaces";
import {
  LOCALE_PORT,
  localeField,
  MAX_WORKSPACE_LENGTH,
  STRING,
  workspaceField,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.create-workspace";
const texts = nodeTexts("actions", ID);
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

const input = z.object({
  id: workspaceField,
  baseLocale: localeField,
  baseLanguageName: z.string().max(MAX_NAME_LENGTH).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  type: z.enum(WORKSPACE_TYPES).or(z.literal("")).optional(),
});

export const createWorkspaceAction = writeAction({
  id: ID,
  icon: "i-ph-folder-plus",
  inputSchema: objectSchema(
    {
      id: {
        type: "string",
        maxLength: MAX_WORKSPACE_LENGTH,
        description: texts.hint("id"),
      },
      baseLocale: LOCALE_PORT,
      baseLanguageName: {
        type: "string",
        maxLength: MAX_NAME_LENGTH,
        description: texts.hint("baseLanguageName"),
      },
      description: {
        type: "string",
        maxLength: MAX_DESCRIPTION_LENGTH,
        description: texts.hint("description"),
      },
      type: {
        type: "string",
        enum: [...WORKSPACE_TYPES],
        description: texts.hint("type"),
      },
    },
    ["id", "baseLocale"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    baseLocale: STRING,
    publicUrl: STRING,
  }),
  input,
  async run(request, writer, options) {
    const created = createWorkspaceService(
      {
        id: request.id,
        locale: { code: request.baseLocale, name: request.baseLanguageName },
        details: { description: request.description, type: request.type },
      },
      writer,
      options,
    );
    return {
      ...created,
      publicUrl: addedLocaleUrl(await publicOrigin(), created.workspace),
    };
  },
});
