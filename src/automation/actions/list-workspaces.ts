import { z } from "zod";
import { listAllWorkspaces } from "../../utils/catalog";
import { workspaceStats } from "../../utils/summary";
import { BOOLEAN, NUMBER, STRING, STRINGS } from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";

const ID = "lang.list-workspaces";
const texts = nodeTexts("actions", ID);
const KINDS = ["default", "added", "modules"] as const;

const input = z.object({
  kinds: z.array(z.enum(KINDS)).max(KINDS.length).optional().default([]),
  includeStats: z.boolean().optional().default(false),
});

export const listWorkspacesAction = readAction({
  id: ID,
  icon: "i-ph-folders",
  inputSchema: objectSchema({
    kinds: {
      type: "array",
      items: { type: "string", enum: [...KINDS] },
      maxItems: KINDS.length,
      default: [],
      description: texts.hint("kinds"),
    },
    includeStats: {
      type: "boolean",
      default: false,
      description: texts.hint("includeStats"),
    },
  }),
  outputSchema: objectSchema({
    workspaces: {
      type: "array",
      items: objectSchema({
        id: STRING,
        kind: STRING,
        editable: BOOLEAN,
        baseLocale: STRING,
        locales: STRINGS,
        description: STRING,
        type: STRING,
        totalKeys: NUMBER,
        coverage: NUMBER,
      }),
    },
    total: NUMBER,
  }),
  input,
  run(request) {
    const workspaces = listAllWorkspaces()
      .filter(
        (workspace) =>
          request.kinds.length === 0 || request.kinds.includes(workspace.kind),
      )
      .map((workspace) => {
        const entry = {
          id: workspace.id,
          kind: workspace.kind,
          editable: workspace.editable,
          baseLocale: workspace.defaultLocale,
          locales: workspace.locales.map((locale) => locale.code),
          description: workspace.description ?? "",
          type: workspace.type ?? "",
        };
        if (!request.includeStats) return entry;
        const stats = workspaceStats(workspace);
        return {
          ...entry,
          totalKeys: stats.totalKeys,
          coverage: stats.coverage,
        };
      });
    return { workspaces, total: workspaces.length };
  },
});
