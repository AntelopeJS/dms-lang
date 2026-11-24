import { z } from "zod";
import { createKeyService } from "../../services/keys";
import { resolveWorkspaceId } from "../../utils/catalog";
import { findLocale } from "../../utils/locale-codes";
import { resolveFlat } from "../../utils/resolve";
import {
  KEY_PORT,
  keyField,
  MAX_KEY_LENGTH,
  MAX_LIST_ITEMS,
  MAX_TEXT_LENGTH,
  NUMBER,
  OBJECT,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.create-key";
const texts = nodeTexts("actions", ID);

const input = z.object({
  workspace: workspaceField,
  key: keyField,
  baseText: z.string().min(1).max(MAX_TEXT_LENGTH),
  texts: z
    .record(z.string(), z.string().max(MAX_TEXT_LENGTH))
    .refine((value) => Object.keys(value).length <= MAX_LIST_ITEMS, {
      message: `at most ${MAX_LIST_ITEMS} languages`,
    })
    .optional()
    .default({}),
  before: z.string().max(MAX_KEY_LENGTH).optional().default(""),
});

export const createKeyAction = writeAction({
  id: ID,
  icon: "i-ph-plus-square",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      key: KEY_PORT,
      baseText: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("baseText"),
      },
      texts: { ...OBJECT, description: texts.hint("texts") },
      before: {
        type: "string",
        maxLength: MAX_KEY_LENGTH,
        description: texts.hint("before"),
      },
    },
    ["workspace", "key", "baseText"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    key: STRING,
    locales: STRINGS,
    totalKeys: NUMBER,
  }),
  input,
  run(request, writer, options) {
    const flat = resolveFlat(resolveWorkspaceId(request.workspace));
    const values = { ...request.texts, [flat.defaultLocale]: request.baseText };
    const write = createKeyService(
      {
        workspace: request.workspace,
        path: request.key,
        values,
        before: request.before || undefined,
      },
      writer,
      options,
    );
    const locales = Object.entries(values)
      .filter(([, text]) => text.trim() !== "")
      .flatMap(([code]) => findLocale(write.store.locales, code) ?? []);
    return {
      workspace: write.workspace,
      key: write.key,
      locales,
      totalKeys: options.dryRun
        ? flat.totalKeys + 1
        : resolveFlat(write.workspace).totalKeys,
    };
  },
});
