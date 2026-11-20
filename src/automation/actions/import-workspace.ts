import { z } from "zod";
import { importWorkspaceService } from "../../services/workspaces";
import { resolveFlat } from "../../utils/resolve";
import { leafPaths, unionKeys } from "../../utils/tree";
import { validated } from "../../validation/validate";
import { workspaceSchema } from "../../validation/workspace.schema";
import {
  MAX_WORKSPACE_LENGTH,
  NUMBER,
  OBJECT,
  STRING,
  STRINGS,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.import-workspace";
const texts = nodeTexts("actions", ID);
const MAX_BACKUP_BYTES = 3_000_000;

const input = z.object({
  backup: z.record(z.unknown()),
  id: z.string().trim().max(MAX_WORKSPACE_LENGTH).optional(),
});

export const importWorkspaceAction = writeAction({
  id: ID,
  icon: "i-ph-upload-simple",
  inputSchema: objectSchema(
    {
      backup: { ...OBJECT, description: texts.hint("backup") },
      id: {
        type: "string",
        maxLength: MAX_WORKSPACE_LENGTH,
        description: texts.hint("id"),
      },
    },
    ["backup"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    baseLocale: STRING,
    locales: STRINGS,
    totalKeys: NUMBER,
  }),
  input,
  run(request, writer, options) {
    if (Buffer.byteLength(JSON.stringify(request.backup)) > MAX_BACKUP_BYTES)
      throw new Error(`${ID}: the backup is larger than 3 MB`);
    const backup = validated(
      workspaceSchema.import.safeParse({
        ...request.backup,
        id: request.id || request.backup.id,
      }),
    );
    const { id, seed } = importWorkspaceService(backup, writer, options);
    return {
      workspace: id,
      baseLocale: seed.defaultLocale,
      locales: seed.locales.map((locale) => locale.code),
      totalKeys: options.dryRun
        ? leafPaths(unionKeys(seed.messages)).length
        : resolveFlat(id).totalKeys,
    };
  },
});
