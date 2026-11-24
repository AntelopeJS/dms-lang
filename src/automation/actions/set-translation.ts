import { z } from "zod";
import { updateKeyService } from "../../services/keys";
import { currentText } from "../../utils/keys";
import { findLocale } from "../../utils/locale-codes";
import { resolveFlat } from "../../utils/resolve";
import { isMissing } from "../../utils/tree";
import {
  BOOLEAN,
  figuresOf,
  KEY_PORT,
  keyField,
  LOCALE_PORT,
  localeField,
  MAX_TEXT_LENGTH,
  NUMBER,
  rowMissing,
  STRING,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.set-translation";
const texts = nodeTexts("actions", ID);

const input = z.object({
  workspace: workspaceField,
  key: keyField,
  locale: localeField,
  text: z.string().max(MAX_TEXT_LENGTH),
  checkExpected: z.boolean().optional().default(false),
  expectedText: z.string().max(MAX_TEXT_LENGTH).optional().default(""),
});

export const setTranslationAction = writeAction({
  id: ID,
  icon: "i-ph-pencil-simple",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      key: KEY_PORT,
      locale: LOCALE_PORT,
      text: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("text"),
      },
      checkExpected: {
        type: "boolean",
        default: false,
        description: texts.hint("checkExpected"),
      },
      expectedText: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("expectedText"),
      },
    },
    ["workspace", "key", "locale", "text"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    key: STRING,
    locale: STRING,
    text: STRING,
    previousText: STRING,
    changed: BOOLEAN,
    isBase: BOOLEAN,
    coverage: NUMBER,
    missing: NUMBER,
  }),
  input,
  run(request, writer, options) {
    const write = updateKeyService(
      {
        workspace: request.workspace,
        path: request.key,
        values: { [request.locale]: request.text },
        expected: request.checkExpected
          ? { [request.locale]: request.expectedText }
          : undefined,
      },
      writer,
      options,
    );
    const { store, workspace, key } = write;
    const locale = findLocale(store.locales, request.locale) ?? request.locale;
    const previousText = currentText(store.messages[locale], key) ?? "";
    const text = isMissing(request.text) ? "" : request.text;
    const flat = resolveFlat(workspace);
    const row = flat.rows.find((entry) => entry.key === key);
    const willMiss = text === "" && isMissing(row?.inherited?.[locale]);
    const delta = options.dryRun
      ? Number(willMiss) - Number(rowMissing(flat, key, locale))
      : 0;
    return {
      workspace,
      key,
      locale,
      text,
      previousText,
      changed: text !== previousText,
      isBase: locale === store.baseLocale,
      ...figuresOf(flat, locale, delta),
    };
  },
});
