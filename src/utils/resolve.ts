import { modulesBaseLocale, projectBaseLocale } from "./catalog";
import { getLocaleCodes, loadMessages } from "./registry";
import { outdatedLocales } from "./review";
import {
  buildTree,
  deepMerge,
  extractTranslationsByPath,
  getValueAtPath,
  isMissing,
  leafPaths,
  type LocaleMessages,
  progressOf,
  type TranslationValue,
  type TreeItem,
  unionKeys,
} from "./tree";
import {
  ALL_WORKSPACE,
  DEFAULT_WORKSPACE,
  getWorkspaceManifest,
  listWorkspaces,
  loadWorkspaceMessages,
  MODULES_WORKSPACE,
  type TranslationSources,
  type WorkspaceKind,
  workspaceKind,
} from "./workspaces";

export {
  ALL_WORKSPACE,
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  type WorkspaceKind,
  workspaceKind,
};

export interface TranslationData {
  tree: TreeItem[];
  localeProgress: Record<string, number>;
  totalKeys: number;
}

export interface ByPathResult {
  translations: Record<string, TranslationValue>;
  inherited?: Record<string, TranslationValue>;
}

export interface FlatRow {
  key: string;
  values: Record<string, TranslationValue>;
  inherited?: Record<string, TranslationValue>;
  overridden?: boolean;
  overrides?: Record<string, TranslationValue>;
  outdated?: string[];
}

export interface FlatResult {
  defaultLocale: string;
  locales: string[];
  rows: FlatRow[];
  localeProgress: Record<string, number>;
  localeMissing: Record<string, number>;
  totalKeys: number;
  baseMissing: number;
  incompleteKeys: number;
}

interface FlatContext {
  defaultLocale: string;
  locales: string[];
  presence: LocaleMessages;
  inherited?: LocaleMessages;
  overrides?: LocaleMessages;
  sources?: TranslationSources;
}

/** The keys of a workspace: the union of its language files, the base language first. */
function keysOf(context: FlatContext): Record<string, unknown> {
  const { [context.defaultLocale]: base, ...others } = context.presence;
  return deepMerge(base ?? {}, unionKeys(others));
}

function ownFlatContext(): FlatContext {
  return {
    defaultLocale: projectBaseLocale(),
    locales: getLocaleCodes("own"),
    presence: loadMessages("own"),
    inherited: loadMessages("external"),
  };
}

function modulesFlatContext(): FlatContext {
  return {
    defaultLocale: modulesBaseLocale(),
    locales: getLocaleCodes("external"),
    presence: loadMessages("external"),
    overrides: loadMessages("own"),
  };
}

function addedFlatContext(workspace: string): FlatContext {
  const manifest = getWorkspaceManifest(workspace);
  return {
    defaultLocale: manifest.defaultLocale,
    locales: manifest.locales.map((locale) => locale.code),
    presence: loadWorkspaceMessages(workspace),
    sources: manifest.sources,
  };
}

const FLAT_CONTEXTS: Record<WorkspaceKind, (workspace: string) => FlatContext> =
  {
    default: ownFlatContext,
    modules: modulesFlatContext,
    added: addedFlatContext,
  };

function contextOf(workspace: string): FlatContext {
  return FLAT_CONTEXTS[workspaceKind(workspace)](workspace);
}

function valuesAtPath(
  messages: LocaleMessages,
  locales: string[],
  path: string,
): Record<string, TranslationValue> {
  const values: Record<string, TranslationValue> = {};
  for (const locale of locales) {
    const value = getValueAtPath(messages[locale], path);
    values[locale] = isMissing(value) ? undefined : (value as TranslationValue);
  }
  return values;
}

function presentValues(
  values: Record<string, TranslationValue>,
): Record<string, TranslationValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => !isMissing(value)),
  );
}

function addOverrides(row: FlatRow, context: FlatContext): void {
  if (!context.overrides) return;
  const overrides = presentValues(
    valuesAtPath(context.overrides, context.locales, row.key),
  );
  row.overridden = Object.keys(overrides).length > 0;
  if (row.overridden) row.overrides = overrides;
}

function buildFlatRow(context: FlatContext, key: string): FlatRow {
  const row: FlatRow = {
    key,
    values: valuesAtPath(context.presence, context.locales, key),
  };
  if (context.inherited) {
    row.inherited = valuesAtPath(context.inherited, context.locales, key);
  }
  addOverrides(row, context);
  const outdated = outdatedLocales(
    context.sources,
    context.presence,
    context.defaultLocale,
    key,
  );
  if (outdated.length > 0) row.outdated = outdated;
  return row;
}

export function isRowMissing(row: FlatRow, locale: string): boolean {
  return isMissing(row.values[locale]) && isMissing(row.inherited?.[locale]);
}

function countMissing(rows: FlatRow[], locale: string): number {
  return rows.filter((row) => isRowMissing(row, locale)).length;
}

function summarizeRows(context: FlatContext, rows: FlatRow[]): FlatResult {
  const localeMissing: Record<string, number> = {};
  const localeProgress: Record<string, number> = {};
  for (const locale of context.locales) {
    const missing = countMissing(rows, locale);
    localeMissing[locale] = missing;
    localeProgress[locale] = progressOf(rows.length - missing, rows.length);
  }
  const targets = context.locales.filter(
    (locale) => locale !== context.defaultLocale,
  );
  return {
    defaultLocale: context.defaultLocale,
    locales: context.locales,
    rows,
    localeProgress,
    localeMissing,
    totalKeys: rows.length,
    baseMissing: localeMissing[context.defaultLocale] ?? 0,
    incompleteKeys: rows.filter((row) =>
      targets.some((locale) => isRowMissing(row, locale)),
    ).length,
  };
}

/**
 * The rows of a workspace and their coverage. Default and modules take the base language of the
 * project, decided by the server; `_fallbackDefaultLocale` is kept for older callers and ignored.
 */
export function resolveFlat(
  workspace: string,
  _fallbackDefaultLocale?: string,
): FlatResult {
  const context = contextOf(workspace);
  const rows = leafPaths(keysOf(context)).map((key) =>
    buildFlatRow(context, key),
  );
  return summarizeRows(context, rows);
}

/** The current row of one key, as /flat would list it (`undefined` once the key is gone). */
export function resolveRow(
  workspace: string,
  key: string,
): FlatRow | undefined {
  const context = contextOf(workspace);
  const row = buildFlatRow(context, key);
  const sources = [context.presence, context.inherited ?? {}];
  const exists = sources.some((messages) =>
    Object.values(messages).some(
      (data) => getValueAtPath(data, key) !== undefined,
    ),
  );
  return exists ? row : undefined;
}

export function resolveTranslationData(
  workspace: string,
  _fallbackDefaultLocale?: string,
): TranslationData {
  const context = contextOf(workspace);
  const presence: LocaleMessages = {};
  for (const locale of context.locales) {
    presence[locale] = deepMerge(
      context.inherited?.[locale] ?? {},
      context.presence[locale] ?? {},
    );
  }
  const flat = resolveFlat(workspace);
  return {
    tree: buildTree(keysOf(context), presence),
    localeProgress: flat.localeProgress,
    totalKeys: flat.totalKeys,
  };
}

function ownByPath(path: string): ByPathResult {
  const context = ownFlatContext();
  return {
    translations: valuesAtPath(context.presence, context.locales, path),
    inherited: valuesAtPath(context.inherited ?? {}, context.locales, path),
  };
}

export function resolveTranslationsByPath(
  workspace: string,
  path: string,
): ByPathResult {
  if (workspaceKind(workspace) === "default") return ownByPath(path);
  return {
    translations: extractTranslationsByPath(
      contextOf(workspace).presence,
      path,
    ),
  };
}

function aggregateRows(parts: FlatResult[]): FlatRow[] {
  return parts.flatMap((part) => part.rows);
}

export function resolveAggregatedFlat(
  _fallbackDefaultLocale?: string,
): FlatResult {
  const ids = [
    DEFAULT_WORKSPACE,
    MODULES_WORKSPACE,
    ...listWorkspaces().map((workspace) => workspace.id),
  ];
  const parts = ids.map((id) => resolveFlat(id));
  const expected: Record<string, number> = {};
  const localeMissing: Record<string, number> = {};
  for (const part of parts) {
    for (const locale of part.locales) {
      expected[locale] = (expected[locale] ?? 0) + part.totalKeys;
      localeMissing[locale] =
        (localeMissing[locale] ?? 0) + (part.localeMissing[locale] ?? 0);
    }
  }
  const localeProgress: Record<string, number> = {};
  for (const [locale, total] of Object.entries(expected)) {
    localeProgress[locale] = progressOf(
      total - (localeMissing[locale] ?? 0),
      total,
    );
  }
  const sum = (field: "totalKeys" | "baseMissing" | "incompleteKeys") =>
    parts.reduce((total, part) => total + part[field], 0);
  return {
    defaultLocale: parts[0]?.defaultLocale ?? projectBaseLocale(),
    locales: Object.keys(expected).sort(),
    rows: aggregateRows(parts),
    localeProgress,
    localeMissing,
    totalKeys: sum("totalKeys"),
    baseMissing: sum("baseMissing"),
    incompleteKeys: sum("incompleteKeys"),
  };
}
