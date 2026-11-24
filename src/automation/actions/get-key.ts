import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import { validateKeyPath } from "../../utils/json";
import { isRowMissing, lookupTexts, resolveFlat } from "../../utils/resolve";
import { isMissing, type TranslationValue } from "../../utils/tree";
import {
  BOOLEAN,
  KEY_PORT,
  keyField,
  OBJECT,
  readWorkspaceField,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
} from "../fields";
import { objectSchema, readAction } from "../support";

const input = z.object({ workspace: readWorkspaceField, key: keyField });

function present(
  values: Record<string, TranslationValue> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values ?? {}).flatMap(([locale, value]) =>
      value === undefined || value === null || isMissing(String(value))
        ? []
        : [[locale, String(value)]],
    ),
  );
}

export const getKeyAction = readAction({
  id: "lang.get-key",
  icon: "i-ph-key",
  inputSchema: objectSchema(
    { workspace: { ...WORKSPACE_PORT, default: "default" }, key: KEY_PORT },
    ["key"],
  ),
  outputSchema: objectSchema({
    exists: BOOLEAN,
    isNamespace: BOOLEAN,
    key: STRING,
    workspace: STRING,
    baseLocale: STRING,
    baseText: STRING,
    values: OBJECT,
    inherited: OBJECT,
    overridden: BOOLEAN,
    missingLocales: STRINGS,
    outdated: STRINGS,
    issues: STRINGS,
  }),
  input,
  run(request) {
    const workspace = resolveWorkspaceId(request.workspace);
    const key = validateKeyPath(request.key).join(".");
    const flat = resolveFlat(workspace);
    const row = flat.rows.find((entry) => entry.key === key);
    const lookup = lookupTexts(workspace, key);
    return {
      exists: row !== undefined,
      isNamespace: lookup.isNamespace,
      key,
      workspace,
      baseLocale: flat.defaultLocale,
      baseText: lookup.texts[flat.defaultLocale] ?? "",
      values: present(row?.values),
      inherited: present(row?.inherited),
      overridden: row?.overridden === true,
      missingLocales: row
        ? flat.locales.filter((locale) => isRowMissing(row, locale))
        : [],
      outdated: row?.outdated ?? [],
      issues: row?.issues ?? [],
    };
  },
});
