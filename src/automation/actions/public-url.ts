import { z } from "zod";
import { findWorkspace } from "../../utils/catalog";
import {
  addedLocaleUrl,
  publicOrigin,
  templateUrl,
} from "../../utils/public-url";
import { readWorkspaceLocale } from "../../utils/workspaces";
import {
  BOOLEAN,
  LOCALE_PORT,
  optionalLocaleField,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";

const ID = "lang.public-url";
const texts = nodeTexts("actions", ID);

const input = z.object({
  workspace: workspaceField,
  locale: optionalLocaleField,
});

export const publicUrlAction = readAction({
  id: ID,
  icon: "i-ph-link",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      locale: { ...LOCALE_PORT, description: texts.hint("locale") },
    },
    ["workspace"],
  ),
  outputSchema: objectSchema({
    served: BOOLEAN,
    url: STRING,
    template: STRING,
    servedLocale: STRING,
  }),
  input,
  async run(request) {
    const summary = findWorkspace(request.workspace);
    if (summary.kind !== "added")
      return { served: false, url: "", template: "", servedLocale: "" };
    const template = addedLocaleUrl(await publicOrigin(), summary.id);
    if (!request.locale)
      return { served: true, url: template, template, servedLocale: "" };
    const served = readWorkspaceLocale(summary.id, request.locale);
    return {
      served: true,
      url: templateUrl(template, request.locale),
      template,
      servedLocale: served?.code ?? "",
    };
  },
});
