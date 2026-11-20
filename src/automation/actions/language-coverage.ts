import { z } from "zod";
import { localeFigures } from "../../utils/blocks";
import { resolveWorkspaceId } from "../../utils/catalog";
import { fail } from "../../utils/errors";
import { nativeName } from "../../utils/languages";
import { findLocale, languageOf } from "../../utils/locale-codes";
import { resolveFlat } from "../../utils/resolve";
import {
  BOOLEAN,
  LOCALE_PORT,
  localeField,
  NUMBER,
  readWorkspaceField,
  STRING,
  WORKSPACE_PORT,
} from "../fields";
import { nodeTexts, objectSchema, readAction } from "../support";

const ID = "lang.language-coverage";
const texts = nodeTexts("actions", ID);

const input = z.object({ workspace: readWorkspaceField, locale: localeField });

export const languageCoverageAction = readAction({
  id: ID,
  icon: "i-ph-chart-donut",
  inputSchema: objectSchema(
    {
      workspace: { ...WORKSPACE_PORT, default: "default" },
      locale: { ...LOCALE_PORT, description: texts.hint("locale") },
    },
    ["locale"],
  ),
  outputSchema: objectSchema({
    locale: STRING,
    name: STRING,
    isBase: BOOLEAN,
    totalKeys: NUMBER,
    translated: NUMBER,
    missing: NUMBER,
    coverage: NUMBER,
    toReview: NUMBER,
    outdated: NUMBER,
    issues: NUMBER,
    complete: BOOLEAN,
  }),
  input,
  run(request) {
    const flat = resolveFlat(resolveWorkspaceId(request.workspace));
    const locale =
      findLocale(flat.locales, request.locale) ??
      findLocale(flat.locales, languageOf(request.locale));
    if (locale === undefined)
      fail("unknown_locale", { locale: request.locale });
    const figures = localeFigures(flat, locale);
    return {
      locale,
      name: nativeName(locale, flat.locales),
      isBase: locale === flat.defaultLocale,
      totalKeys: figures.total,
      translated: figures.translated,
      missing: figures.missing,
      coverage: figures.coverage,
      toReview: figures.issues,
      outdated: flat.rows.filter((row) => row.outdated?.includes(locale))
        .length,
      issues: flat.rows.filter((row) => row.issues?.includes(locale)).length,
      complete: figures.missing === 0,
    };
  },
});
