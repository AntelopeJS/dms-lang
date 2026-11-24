import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import { fail } from "../../utils/errors";
import { findLocale } from "../../utils/locale-codes";
import {
  type FlatResult,
  isRowMissing,
  resolveFlat,
} from "../../utils/resolve";
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

const ID = "lang.missing-keys";
const texts = nodeTexts("actions", ID);
const MAX_PAGE = 500;
const DEFAULT_PAGE = 50;

export const pageFields = {
  limit: z.number().int().min(1).max(MAX_PAGE).optional().default(DEFAULT_PAGE),
  offset: z.number().int().min(0).optional().default(0),
};

export const PAGE_PORTS = {
  limit: {
    type: "integer",
    minimum: 1,
    maximum: MAX_PAGE,
    default: DEFAULT_PAGE,
    description: "$dms_lang.automation.hints.limit",
  },
  offset: {
    type: "integer",
    minimum: 0,
    default: 0,
    description: "$dms_lang.automation.hints.offset",
  },
};

/** The stored code of a language of a workspace; `unknown_locale` otherwise. */
export function workspaceLocale(flat: FlatResult, code: string): string {
  const locale = findLocale(flat.locales, code);
  if (locale === undefined) fail("unknown_locale", { locale: code });
  return locale;
}

const input = z.object({
  workspace: readWorkspaceField,
  locale: localeField,
  keyPrefix: keyPrefixField,
  ...pageFields,
});

export const missingKeysAction = readAction({
  id: ID,
  icon: "i-ph-list-dashes",
  inputSchema: objectSchema(
    {
      workspace: { ...WORKSPACE_PORT, default: "default" },
      locale: { ...LOCALE_PORT, description: texts.hint("locale") },
      keyPrefix: KEY_PREFIX_PORT,
      ...PAGE_PORTS,
    },
    ["locale"],
  ),
  outputSchema: objectSchema({
    locale: STRING,
    items: {
      type: "array",
      items: objectSchema({ key: STRING, baseText: STRING }),
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
    const matching = flat.rows.filter(
      (row) =>
        matchesPrefix(row.key, request.keyPrefix) && isRowMissing(row, locale),
    );
    const page = matching.slice(request.offset, request.offset + request.limit);
    const items = page.map((row) => ({
      key: row.key,
      baseText: String(row.values[base] ?? row.inherited?.[base] ?? ""),
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
