import { z } from "zod";
import { importLanguageService } from "../../services/keys";
import { resolveWorkspaceId } from "../../utils/catalog";
import { isString } from "../../utils/guards";
import { findLocale } from "../../utils/locale-codes";
import { resolveFlat } from "../../utils/resolve";
import { isMissing } from "../../utils/tree";
import {
  figuresOf,
  LOCALE_PORT,
  localeField,
  MAX_TEXT_LENGTH,
  NUMBER,
  OBJECT,
  rowMissing,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.import-language";
const texts = nodeTexts("actions", ID);
const MAX_TEXTS = 5000;
const MAX_LISTED = 500;
const MODES = ["merge", "fillMissing", "replace"] as const;

/** Texts under namespaces, nested or flat (`{ "a.b": "text" }`). */
interface MessageTree {
  [name: string]: string | MessageTree;
}

const messageTree: z.ZodType<MessageTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string().max(MAX_TEXT_LENGTH), messageTree])),
);

const input = z.object({
  workspace: workspaceField,
  locale: localeField,
  messages: messageTree,
  mode: z.enum(MODES).optional().default("merge"),
  createKeys: z.boolean().optional().default(false),
});

/** The texts of a nested or flat tree as `[path, text]` pairs. */
function flatTexts(tree: MessageTree): [string, string][] {
  const texts: [string, string][] = [];
  const walk = (node: MessageTree, prefix: string): void => {
    for (const [name, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${name}` : name;
      if (isString(value)) texts.push([path, value]);
      else walk(value, path);
      if (texts.length > MAX_TEXTS)
        throw new Error(`${ID}: at most ${MAX_TEXTS} texts per step`);
    }
  };
  walk(tree, "");
  return texts;
}

export const importLanguageAction = writeAction({
  id: ID,
  icon: "i-ph-download-simple",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      locale: LOCALE_PORT,
      messages: { ...OBJECT, description: texts.hint("messages") },
      mode: {
        type: "string",
        enum: [...MODES],
        default: "merge",
        description: texts.hint("mode"),
      },
      createKeys: {
        type: "boolean",
        default: false,
        description: texts.hint("createKeys"),
      },
    },
    ["workspace", "locale", "messages"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    locale: STRING,
    written: NUMBER,
    unchanged: NUMBER,
    cleared: NUMBER,
    created: STRINGS,
    skipped: STRINGS,
    coverage: NUMBER,
    missing: NUMBER,
  }),
  input,
  run(request, writer, options) {
    const entries = flatTexts(request.messages);
    const before = resolveFlat(resolveWorkspaceId(request.workspace));
    if (
      request.mode === "replace" &&
      findLocale([before.defaultLocale], request.locale) !== undefined
    )
      throw new Error(
        `${ID}: mode "replace" would clear texts of the base language ${before.defaultLocale}; use "merge" (replace_base)`,
      );
    const { workspace, imported } = importLanguageService(
      {
        workspace: request.workspace,
        locale: request.locale,
        texts: entries,
        mode: request.mode,
        createKeys: request.createKeys,
      },
      writer,
      options,
    );
    const { locale } = imported;
    const created = new Set(imported.created);
    const filled = imported.written.filter(
      (key) => !created.has(key) && rowMissing(before, key, locale),
    ).length;
    const emptied = imported.cleared.filter((key) =>
      isMissing(
        before.rows.find((row) => row.key === key)?.inherited?.[locale],
      ),
    ).length;
    const figures = options.dryRun
      ? figuresOf(before, locale, emptied - filled, created.size)
      : figuresOf(resolveFlat(workspace), locale);
    return {
      workspace,
      locale,
      written: imported.written.length,
      unchanged: imported.unchanged,
      cleared: imported.cleared.length,
      created: imported.created.slice(0, MAX_LISTED),
      skipped: imported.skipped.slice(0, MAX_LISTED),
      ...figures,
    };
  },
});
