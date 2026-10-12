import type {
  ComposedText,
  ComposedTextCountParam,
  ComposedTextNumberParam,
} from "@antelopejs/interface-dms/base/types";
import { findWorkspace } from "./catalog";
import { LANG_TEXTS } from "./constants";
import { coveragePercent, FULL_COVERAGE } from "./coverage";
import { languageOf } from "./locale-codes";
import { type FlatResult, resolveFlat } from "./resolve";

const LANGUAGE_NAME: Intl.DisplayNamesOptions = {
  type: "language",
  fallback: "none",
};
const REGIONAL_NAME: Intl.DisplayNamesOptions = {
  type: "language",
  languageDisplay: "standard",
  fallback: "none",
};

interface Subline {
  text: ComposedText;
  tone: "dimmed" | "warning";
}

export interface LanguageRow {
  _id: string;
  code: string;
  workspace: string;
  name: string;
  detail: Subline;
  isBase: boolean;
  /** The texts can be edited (not the modules, nor a read-only module config). */
  canEdit: boolean;
  /** Languages can be added, removed and made base (added workspaces). */
  canManage: boolean;
  translated: number;
  total: number;
  missing: number;
  /** Percent of the keys with a text in the language. */
  coverage: number;
}

export interface LanguageRows {
  results: LanguageRow[];
  total: number;
}

interface LanguageCounts {
  code: string;
  isBase: boolean;
  translated: number;
  total: number;
  missing: number;
}

export function percentParam(coverage: number): ComposedTextNumberParam {
  return {
    type: "number",
    value: coverage / FULL_COVERAGE,
    format: "percent",
  };
}

function displayName(
  code: string,
  subject: string,
  options: Intl.DisplayNamesOptions,
): string {
  try {
    const name = new Intl.DisplayNames([code], options).of(subject) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}

/**
 * The name of a language in that language, without its region ("Português")
 * unless another of `siblings` is the same language ("Português (Brasil)").
 */
export function nativeName(code: string, siblings: string[] = []): string {
  const language = languageOf(code);
  const isShared = siblings.some(
    (other) => other !== code && languageOf(other) === language,
  );
  return isShared
    ? displayName(code, code, REGIONAL_NAME)
    : displayName(code, language, LANGUAGE_NAME);
}

interface WorkspaceRights {
  canEdit: boolean;
  canManage: boolean;
}

function rightsOf(workspace: string): WorkspaceRights {
  const { editable, kind } = findWorkspace(workspace);
  return { canEdit: editable, canManage: editable && kind === "added" };
}

function count(value: number): ComposedTextCountParam {
  return { type: "count", value };
}

function baseDetail({ code, translated, missing }: LanguageCounts): Subline {
  return missing
    ? {
        text: {
          key: `${LANG_TEXTS}.languages.detail_base_missing`,
          params: { code, n: count(missing) },
        },
        tone: "warning",
      }
    : {
        text: {
          key: `${LANG_TEXTS}.languages.detail_base`,
          params: { code, n: count(translated) },
        },
        tone: "dimmed",
      };
}

function targetDetail({
  code,
  translated,
  total,
  missing,
}: LanguageCounts): Subline {
  if (!missing) {
    return {
      text: {
        key: `${LANG_TEXTS}.languages.detail_complete`,
        params: { code },
      },
      tone: "dimmed",
    };
  }
  return {
    text: {
      key: `${LANG_TEXTS}.languages.detail`,
      params: {
        code,
        percent: percentParam(coveragePercent(translated, total)),
        n: count(missing),
      },
    },
    tone: "dimmed",
  };
}

function countsOf(flat: FlatResult, code: string): LanguageCounts {
  const total = flat.rows.length;
  const missing = flat.localeMissing[code] ?? 0;
  return {
    code,
    isBase: code === flat.defaultLocale,
    translated: total - missing,
    total,
    missing,
  };
}

/**
 * The languages of a workspace, as rows of a source table, in the order of
 * the workspace: the table sorts them and pins the base.
 */
export function listLanguages(workspace: string): LanguageRows {
  const flat = resolveFlat(workspace);
  const rights = rightsOf(workspace);
  const results = flat.locales.map((code) => {
    const counts = countsOf(flat, code);
    return {
      _id: code,
      code,
      workspace,
      name: nativeName(code, flat.locales),
      detail: counts.isBase ? baseDetail(counts) : targetDetail(counts),
      isBase: counts.isBase,
      ...rights,
      translated: counts.translated,
      total: counts.total,
      missing: counts.missing,
      coverage: coveragePercent(counts.translated, counts.total),
    };
  });
  return { results, total: results.length };
}
