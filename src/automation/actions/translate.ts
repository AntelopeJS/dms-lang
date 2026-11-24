import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import { translate } from "../../utils/translate";
import {
  BOOLEAN,
  KEY_PORT,
  keyField,
  LOCALE_PORT,
  localeField,
  MAX_LOCALE_LENGTH,
  OBJECT,
  optionalLocaleField,
  readWorkspaceField,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
} from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";

const ID = "lang.translate";
const texts = nodeTexts("actions", ID);
const MAX_PARAMS = 50;
const ON_MISSING = ["fail", "empty", "key"] as const;

export const messageParamsField = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .refine((value) => Object.keys(value).length <= MAX_PARAMS, {
    message: `at most ${MAX_PARAMS} parameters`,
  })
  .optional()
  .transform((value) => value ?? {});

export const PARAMS_PORT = {
  ...OBJECT,
  description: "$dms_lang.automation.hints.params",
};

const input = z.object({
  workspace: readWorkspaceField,
  key: keyField,
  locale: localeField,
  fallbackLocale: optionalLocaleField,
  fallback: z.boolean().optional().default(true),
  params: messageParamsField,
  onMissing: z.enum(ON_MISSING).optional().default("fail"),
});

export const translateAction = readAction({
  id: ID,
  icon: "i-ph-translate",
  inputSchema: objectSchema(
    {
      workspace: { ...WORKSPACE_PORT, default: "default" },
      key: KEY_PORT,
      locale: LOCALE_PORT,
      fallbackLocale: {
        type: "string",
        maxLength: MAX_LOCALE_LENGTH,
        description: texts.hint("fallbackLocale"),
      },
      fallback: {
        type: "boolean",
        default: true,
        description: texts.hint("fallback"),
      },
      params: PARAMS_PORT,
      onMissing: {
        type: "string",
        enum: [...ON_MISSING],
        default: "fail",
        description: texts.hint("onMissing"),
      },
    },
    ["key", "locale"],
  ),
  outputSchema: objectSchema({
    text: STRING,
    template: STRING,
    found: BOOLEAN,
    locale: STRING,
    usedFallback: BOOLEAN,
    missingParams: STRINGS,
  }),
  input,
  run(request) {
    const workspace = resolveWorkspaceId(request.workspace);
    const result = translate({ ...request, workspace });
    if (result.found) return { ...result };
    if (request.onMissing === "fail")
      throw new Error(
        `Lang: key "${request.key}" has no text in ${request.locale} nor its fallbacks in translation workspace "${workspace}" (missing_text)`,
      );
    return { ...result, text: request.onMissing === "key" ? request.key : "" };
  },
});
