import { GetClientBaseUrl } from "@antelopejs/interface-dms/client-base-url";
import { FALLBACK_LOCALE, listAllWorkspaces } from "./catalog";
import { getTranslationConfig } from "./config";
import { isRowMissing, resolveFlat } from "./resolve";

const TEXTS = "dms_lang";
const PERCENT = 100;
const NATIVE_DISPLAY: Intl.DisplayNamesOptions = {
  type: "language",
  fallback: "none",
};
const LANGUAGE_SEPARATOR = /[-_]/;
const BASE_RANK = -1;

interface ComposedText {
  key: string;
  params?: Record<string, string | { type: "count"; value: number }>;
}

export interface LanguageRow {
  _id: string;
  code: string;
  workspace: string;
  name: string;
  detail: ComposedText;
  isBase: boolean;
  canManage: boolean;
  translated: number;
  total: number;
  missing: number;
  rank: number;
}

export interface LanguageRows {
  results: LanguageRow[];
  total: number;
}

export function nativeName(code: string): string {
  const language = code.split(LANGUAGE_SEPARATOR)[0];
  try {
    const name =
      new Intl.DisplayNames([code], NATIVE_DISPLAY).of(language) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}

function canManageWorkspace(workspace: string): boolean {
  const summary = listAllWorkspaces().find((entry) => entry.id === workspace);
  return summary?.kind === "added" && getTranslationConfig().editable;
}

function detailOf(
  code: string,
  isBase: boolean,
  translated: number,
  total: number,
): ComposedText {
  const count = { type: "count" as const, value: translated };
  return isBase
    ? { key: `${TEXTS}.languages.detail_base`, params: { code, n: count } }
    : {
        key: `${TEXTS}.languages.detail`,
        params: { code, n: count, total: String(total) },
      };
}

/** The languages of a workspace, as rows of a source table. */
export function listLanguages(workspace: string): LanguageRows {
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  const canManage = canManageWorkspace(workspace);
  const total = flat.rows.length;
  const results = flat.locales.map((code) => {
    const missing = flat.rows.filter((row) => isRowMissing(row, code)).length;
    const translated = total - missing;
    const isBase = code === flat.defaultLocale;
    const coverage = total
      ? Math.round((translated / total) * PERCENT)
      : PERCENT;
    return {
      _id: code,
      code,
      workspace,
      name: nativeName(code),
      detail: detailOf(code, isBase, translated, total),
      isBase,
      canManage,
      translated,
      total,
      missing: isBase ? 0 : missing,
      rank: isBase ? BASE_RANK : coverage,
    };
  });
  return { results, total: results.length };
}

export async function publicLocaleUrl(
  workspace: string,
  locale = "{locale}",
): Promise<string> {
  const base = (await GetClientBaseUrl()) ?? "";
  return `${base}/i18n/${workspace}/${locale}.json`;
}
