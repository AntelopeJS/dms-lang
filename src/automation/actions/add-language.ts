import { z } from "zod";
import { addLanguageService } from "../../services/workspaces";
import { resolveFlat } from "../../utils/resolve";
import {
  LOCALE_PORT,
  localeField,
  NUMBER,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.add-language";
const texts = nodeTexts("actions", ID);
const MAX_NAME_LENGTH = 100;
const MAX_FLAG_LENGTH = 16;

const input = z.object({
  workspace: workspaceField,
  code: localeField,
  name: z.string().max(MAX_NAME_LENGTH).optional(),
  flag: z.string().max(MAX_FLAG_LENGTH).optional(),
});

export const addLanguageAction = writeAction({
  id: ID,
  icon: "i-ph-globe-simple",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      code: LOCALE_PORT,
      name: {
        type: "string",
        maxLength: MAX_NAME_LENGTH,
        description: texts.hint("name"),
      },
      flag: {
        type: "string",
        maxLength: MAX_FLAG_LENGTH,
        description: texts.hint("flag"),
      },
    },
    ["workspace", "code"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    code: STRING,
    sameLanguage: STRINGS,
    totalKeys: NUMBER,
    missing: NUMBER,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const added = addLanguageService(
      {
        workspace: request.workspace,
        locale: { code: request.code, name: request.name, flag: request.flag },
      },
      writer,
      options,
    );
    const { totalKeys } = resolveFlat(added.workspace);
    return {
      workspace: added.workspace,
      code: added.code,
      sameLanguage: added.sameLanguage,
      totalKeys,
      missing: totalKeys,
    };
  },
});
