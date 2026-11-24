import { z } from "zod";
import { resolveWorkspaceId } from "../../utils/catalog";
import { coveragePercent } from "../../utils/coverage";
import { fail } from "../../utils/errors";
import { findLocale } from "../../utils/locale-codes";
import { namespaceCoverage } from "../../utils/namespaces";
import {
  BOOLEAN,
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

const ID = "lang.namespace-coverage";
const texts = nodeTexts("actions", ID);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const input = z.object({
  workspace: readWorkspaceField,
  locale: optionalLocaleField,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .default(DEFAULT_LIMIT),
});

export const namespaceCoverageAction = readAction({
  id: ID,
  icon: "i-ph-grid-four",
  inputSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, default: "default" },
    locale: { ...LOCALE_PORT, description: texts.hint("locale") },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_LIMIT,
      default: DEFAULT_LIMIT,
      description: "$dms_lang.automation.hints.limit",
    },
  }),
  outputSchema: objectSchema({
    locales: STRINGS,
    namespaces: {
      type: "array",
      items: objectSchema({
        namespace: STRING,
        keys: NUMBER,
        missing: OBJECT,
        coverage: OBJECT,
      }),
    },
    total: NUMBER,
    truncated: BOOLEAN,
  }),
  input,
  run(request) {
    const heatmap = namespaceCoverage(resolveWorkspaceId(request.workspace));
    const wanted = request.locale;
    const chosen = wanted ? findLocale(heatmap.locales, wanted) : undefined;
    if (wanted && chosen === undefined)
      fail("unknown_locale", { locale: wanted });
    const locales = chosen === undefined ? heatmap.locales : [chosen];
    const rows =
      chosen === undefined
        ? heatmap.namespaces
        : [...heatmap.namespaces].sort(
            (left, right) =>
              (right.missing[chosen] ?? 0) / right.keys -
                (left.missing[chosen] ?? 0) / left.keys ||
              (right.missing[chosen] ?? 0) - (left.missing[chosen] ?? 0) ||
              left.namespace.localeCompare(right.namespace),
          );
    const namespaces = rows.map((row) => ({
      namespace: row.namespace,
      keys: row.keys,
      missing: Object.fromEntries(
        locales.map((locale) => [locale, row.missing[locale] ?? 0]),
      ),
      coverage: Object.fromEntries(
        locales.map((locale) => [
          locale,
          coveragePercent(row.keys - (row.missing[locale] ?? 0), row.keys),
        ]),
      ),
    }));
    return {
      locales,
      namespaces: namespaces.slice(0, request.limit),
      total: namespaces.length,
      truncated: namespaces.length > request.limit,
    };
  },
});
