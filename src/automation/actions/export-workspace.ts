import type { JsonObject } from "@antelopejs/interface-dms-automation";
import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import {
  backupWorkspace,
  exportLanguage,
  exportWorkspace,
} from "../../utils/export";
import { findLocale } from "../../utils/locale-codes";
import { leafPaths, unionKeys } from "../../utils/tree";
import {
  LOCALE_PORT,
  NUMBER,
  OBJECT,
  optionalLocaleField,
  readWorkspaceField,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
} from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";

const ID = "lang.export-workspace";
const texts = nodeTexts("actions", ID);
const FORMATS = ["messages", "backup"] as const;
const DEFAULT_MAX_BYTES = 1_000_000;
const MIN_MAX_BYTES = 1000;
const MAX_MAX_BYTES = 3_000_000;

const input = z.object({
  workspace: readWorkspaceField,
  locale: optionalLocaleField,
  format: z.enum(FORMATS).optional().default("messages"),
  maxBytes: z
    .number()
    .int()
    .min(MIN_MAX_BYTES)
    .max(MAX_MAX_BYTES)
    .optional()
    .default(DEFAULT_MAX_BYTES),
});

export const exportWorkspaceAction = readAction({
  id: ID,
  icon: "i-ph-export",
  inputSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, default: "default" },
    locale: { ...LOCALE_PORT, description: texts.hint("locale") },
    format: {
      type: "string",
      enum: [...FORMATS],
      default: "messages",
      description: texts.hint("format"),
    },
    maxBytes: {
      type: "integer",
      minimum: MIN_MAX_BYTES,
      maximum: MAX_MAX_BYTES,
      default: DEFAULT_MAX_BYTES,
      description: texts.hint("maxBytes"),
    },
  }),
  outputSchema: objectSchema({
    format: STRING,
    data: OBJECT,
    locales: STRINGS,
    keyCount: NUMBER,
    bytes: NUMBER,
  }),
  input,
  run(request) {
    const workspace = resolveWorkspaceId(request.workspace);
    const all = exportWorkspace(workspace);
    let data;
    let locales: string[];
    if (request.format === "backup") {
      const { description, type, ...backup } = backupWorkspace(workspace);
      const details: JsonObject = {};
      if (description !== undefined) details.description = description;
      if (type !== undefined) details.type = type;
      data = {
        ...backup,
        locales: backup.locales.map((locale) => ({ ...locale })),
        ...details,
      };
      locales = Object.keys(all);
    } else if (request.locale) {
      data = exportLanguage(workspace, request.locale);
      locales = [
        findLocale(Object.keys(all), request.locale) ?? request.locale,
      ];
    } else {
      data = all;
      locales = Object.keys(all);
    }
    const bytes = Buffer.byteLength(JSON.stringify(data));
    if (bytes > request.maxBytes)
      throw new Error(
        `Lang: the export of translation workspace "${workspace}" is ${bytes} bytes, above maxBytes ${request.maxBytes}; export one language per step (export_too_large)`,
      );
    const counted = Object.fromEntries(
      locales.map((locale) => [locale, all[locale] ?? {}]),
    );
    return {
      format: request.format,
      data,
      locales,
      keyCount: leafPaths(unionKeys(counted)).length,
      bytes,
    };
  },
});
