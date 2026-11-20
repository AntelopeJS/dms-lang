import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import { resolveFlat } from "../../utils/resolve";
import {
  BOOLEAN,
  KEY_PREFIX_PORT,
  keyPrefixField,
  LOCALE_PORT,
  localeField,
  matchesPrefix,
  NUMBER,
  readWorkspaceField,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
} from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";
import { PAGE_PORTS, pageFields, workspaceLocale } from "./missing-keys";

const ID = "lang.keys-to-review";
const texts = nodeTexts("actions", ID);
const REASONS = ["any", "outdated", "issue"] as const;

const input = z.object({
  workspace: readWorkspaceField,
  locale: localeField,
  reason: z.enum(REASONS).optional().default("any"),
  keyPrefix: keyPrefixField,
  ...pageFields,
});

export const keysToReviewAction = readAction({
  id: ID,
  icon: "i-ph-magnifying-glass",
  inputSchema: objectSchema(
    {
      workspace: { ...WORKSPACE_PORT, default: "default" },
      locale: { ...LOCALE_PORT, description: texts.hint("locale") },
      reason: {
        type: "string",
        enum: [...REASONS],
        default: "any",
        description: texts.hint("reason"),
      },
      keyPrefix: KEY_PREFIX_PORT,
      ...PAGE_PORTS,
    },
    ["locale"],
  ),
  outputSchema: objectSchema({
    locale: STRING,
    items: {
      type: "array",
      items: objectSchema({
        key: STRING,
        text: STRING,
        baseText: STRING,
        outdated: BOOLEAN,
        issue: BOOLEAN,
      }),
    },
    keys: STRINGS,
    total: NUMBER,
    hasMore: BOOLEAN,
  }),
  input,
  run(request) {
    const flat = resolveFlat(resolveWorkspaceId(request.workspace));
    const locale = workspaceLocale(flat, request.locale);
    const base = flat.defaultLocale;
    const matching = flat.rows
      .filter((row) => matchesPrefix(row.key, request.keyPrefix))
      .map((row) => ({
        row,
        outdated: row.outdated?.includes(locale) ?? false,
        issue: row.issues?.includes(locale) ?? false,
      }))
      .filter(({ outdated, issue }) =>
        request.reason === "outdated"
          ? outdated
          : request.reason === "issue"
            ? issue
            : outdated || issue,
      );
    const page = matching.slice(request.offset, request.offset + request.limit);
    const items = page.map(({ row, outdated, issue }) => ({
      key: row.key,
      text: String(row.values[locale] ?? ""),
      baseText: String(row.values[base] ?? row.inherited?.[base] ?? ""),
      outdated,
      issue,
    }));
    return {
      locale,
      items,
      keys: items.map((item) => item.key),
      total: matching.length,
      hasMore: request.offset + page.length < matching.length,
    };
  },
});
