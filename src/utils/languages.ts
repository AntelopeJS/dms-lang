import type { LanguageSort, SortedColumn } from "../validation/query.schema";
import { FALLBACK_LOCALE, listAllWorkspaces } from "./catalog";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";

const TEXTS = "dms_lang";
const PERCENT = 100;
const LANGUAGE_NAME: Intl.DisplayNamesOptions = {
  type: "language",
  fallback: "none",
};
const REGIONAL_NAME: Intl.DisplayNamesOptions = {
  type: "language",
  languageDisplay: "standard",
  fallback: "none",
};
const LANGUAGE_SEPARATOR = /[-_]/;
const BASE_RANK = -1;

interface CountParam {
  type: "count";
  value: number;
}

interface PercentParam {
  type: "number";
  value: number;
  format: "percent";
}

interface ComposedText {
  key: string;
  params?: Record<string, string | CountParam | PercentParam>;
}

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
  /** The base first (-1), then the least complete: the order the table opens on. */
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

/**
 * Share of `total` that is translated, rounded down: a language missing a
 * single key never reads 100.
 */
export function coveragePercent(translated: number, total: number): number {
  return total ? Math.floor((translated / total) * PERCENT) : PERCENT;
}

export function percentParam(coverage: number): PercentParam {
  return { type: "number", value: coverage / PERCENT, format: "percent" };
}

function languageOf(code: string): string {
  return code.split(LANGUAGE_SEPARATOR)[0];
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
  const summary = listAllWorkspaces().find((entry) => entry.id === workspace);
  const canEdit = summary?.editable === true;
  return { canEdit, canManage: canEdit && summary?.kind === "added" };
}

function count(value: number): CountParam {
  return { type: "count", value };
}

function baseDetail({ code, translated, missing }: LanguageCounts): Subline {
  return missing
    ? {
        text: {
          key: `${TEXTS}.languages.detail_base_missing`,
          params: { code, n: count(missing) },
        },
        tone: "warning",
      }
    : {
        text: {
          key: `${TEXTS}.languages.detail_base`,
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
      text: { key: `${TEXTS}.languages.detail_complete`, params: { code } },
      tone: "dimmed",
    };
  }
  return {
    text: {
      key: `${TEXTS}.languages.detail`,
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
  const missing = flat.rows.filter((row) => isRowMissing(row, code)).length;
  return {
    code,
    isBase: code === flat.defaultLocale,
    translated: total - missing,
    total,
    missing,
  };
}

const DESCENDING = "desc";
const DEFAULT_COLUMN = "coverage";

type RowOrder = (a: LanguageRow, b: LanguageRow) => number;

const SORTED_COLUMNS: Record<SortedColumn, RowOrder> = {
  name: (a, b) => a.name.localeCompare(b.name),
  coverage: (a, b) => a.coverage - b.coverage,
};

function compareRows(sort: LanguageSort): RowOrder {
  const column = SORTED_COLUMNS[sort.sortKey ?? DEFAULT_COLUMN];
  const direction = sort.sortDirection === DESCENDING ? -1 : 1;
  return (a: LanguageRow, b: LanguageRow) =>
    Number(b.isBase) - Number(a.isBase) ||
    direction * column(a, b) ||
    a.name.localeCompare(b.name);
}

/**
 * The languages of a workspace, as rows of a source table: the base pinned
 * first whatever the sort, then the least complete (or the sort asked for),
 * then by name. Without a sort the rows come in the order the table opens on.
 */
export function listLanguages(
  workspace: string,
  sort: LanguageSort = {},
): LanguageRows {
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  const rights = rightsOf(workspace);
  const results = flat.locales
    .map((code) => {
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
        coverage: counts.isBase
          ? BASE_RANK
          : coveragePercent(counts.translated, counts.total),
      };
    })
    .sort(compareRows(sort));
  return { results, total: results.length };
}
