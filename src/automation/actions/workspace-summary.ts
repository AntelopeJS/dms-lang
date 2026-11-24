import { z } from "zod";
import { findWorkspace } from "../../utils/catalog";
import { publicLocaleUrl, publicOrigin } from "../../utils/public-url";
import { workspaceStats } from "../../utils/summary";
import {
  BOOLEAN,
  NUMBER,
  OBJECT,
  readWorkspaceField,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
} from "../fields";
import { objectSchema, readAction } from "../support";

const input = z.object({ workspace: readWorkspaceField });

export const workspaceSummaryAction = readAction({
  id: "lang.workspace-summary",
  icon: "i-ph-clipboard-text",
  inputSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, default: "default" },
  }),
  outputSchema: objectSchema({
    workspace: STRING,
    kind: { type: "string", enum: ["default", "modules", "added"] },
    editable: BOOLEAN,
    description: STRING,
    type: STRING,
    baseLocale: STRING,
    locales: STRINGS,
    targets: NUMBER,
    totalKeys: NUMBER,
    translatedStrings: NUMBER,
    missing: NUMBER,
    coverage: NUMBER,
    baseMissing: NUMBER,
    incompleteKeys: NUMBER,
    overrides: NUMBER,
    localeProgress: OBJECT,
    localeMissing: OBJECT,
    publicUrl: STRING,
  }),
  input,
  async run(request) {
    const origin = await publicOrigin();
    const stats = workspaceStats(
      findWorkspace(request.workspace),
      (workspace) => publicLocaleUrl(origin, workspace),
    );
    return {
      workspace: stats.id,
      kind: stats.kind,
      editable: stats.editable,
      description: stats.description ?? "",
      type: stats.type ?? "",
      baseLocale: stats.baseLocale,
      locales: stats.locales.map((locale) => locale.code),
      targets: stats.targets,
      totalKeys: stats.totalKeys,
      translatedStrings: stats.translatedStrings,
      missing: stats.missing,
      coverage: stats.coverage,
      baseMissing: stats.baseMissing,
      incompleteKeys: stats.incompleteKeys,
      overrides: stats.overrides,
      localeProgress: stats.localeProgress,
      localeMissing: stats.localeMissing,
      publicUrl: stats.publicUrl ?? "",
    };
  },
});
