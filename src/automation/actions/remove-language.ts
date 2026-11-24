import { z } from "zod";
import { removeLanguageService } from "../../services/workspaces";
import { resolveWorkspaceId } from "../../utils/catalog";
import { resolveFlat } from "../../utils/resolve";
import {
  LOCALE_PORT,
  localeField,
  NUMBER,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, objectSchema, writeAction } from "../support";

const ID = "lang.remove-language";

const input = z.object({ workspace: workspaceField, code: localeField });

export const removeLanguageAction = writeAction({
  id: ID,
  icon: "i-ph-globe-x",
  inputSchema: objectSchema({ workspace: WORKSPACE_PORT, code: LOCALE_PORT }, [
    "workspace",
    "code",
  ]),
  outputSchema: objectSchema({
    workspace: STRING,
    code: STRING,
    textsRemoved: NUMBER,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const before = resolveFlat(resolveWorkspaceId(request.workspace));
    const removed = removeLanguageService(request, writer, options);
    return {
      workspace: removed.workspace,
      code: removed.code,
      textsRemoved:
        before.totalKeys - (before.localeMissing[removed.code] ?? 0),
    };
  },
});
