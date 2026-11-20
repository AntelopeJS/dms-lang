import { z } from "zod";
import { setBaseLanguageService } from "../../services/workspaces";
import {
  BOOLEAN,
  LOCALE_PORT,
  localeField,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, objectSchema, writeAction } from "../support";

const ID = "lang.set-base-language";

const input = z.object({ workspace: workspaceField, code: localeField });

export const setBaseLanguageAction = writeAction({
  id: ID,
  icon: "i-ph-star",
  inputSchema: objectSchema({ workspace: WORKSPACE_PORT, code: LOCALE_PORT }, [
    "workspace",
    "code",
  ]),
  outputSchema: objectSchema({
    workspace: STRING,
    baseLocale: STRING,
    previousBaseLocale: STRING,
    changed: BOOLEAN,
    reviewTrackingCleared: BOOLEAN,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const result = setBaseLanguageService(request, writer, options);
    const changed = result.baseLocale !== result.previousBaseLocale;
    return { ...result, changed, reviewTrackingCleared: changed };
  },
});
