import { createMemo, filesStamp } from "./cache";
import { modulesBaseLocale, projectBaseLocale } from "./catalog";
import { coveragePercent } from "./coverage";
import { isJsonObject, type JsonObject } from "./json";
import { hasMessageIssue } from "./message-check";
import { getLocaleCodes, loadMessages, registryStamp } from "./registry";
import { outdatedLocales } from "./review";
import {
  deepMerge,
  getValueAtPath,
  isMissing,
  leafPaths,
  type LocaleMessages,
  type TranslationValue,
  unionKeys,
} from "./tree";
import {
  getWorkspaceManifest,
  loadWorkspaceMessages,
  type TranslationSources,
  type WorkspaceKind,
  workspaceFiles,
  workspaceKind,
} from "./workspaces";

const memoizeFlat = createMemo<FlatResult>();

export interface FlatRow {
  key: string;
  values: Record<string, TranslationValue>;
  inherited?: Record<string, TranslationValue>;
  overridden?: boolean;
  overrides?: Record<string, TranslationValue>;
  outdated?: string[];
  /** Languages whose text has an issue (see {@link hasMessageIssue}); the base text is checked alone. */
  issues?: string[];
}

/** The figures of a workspace a write changes, sent back with the row it wrote. */
export interface FlatCounts {
  localeProgress: Record<string, number>;
  localeMissing: Record<string, number>;
  totalKeys: number;
  baseMissing: number;
  incompleteKeys: number;
}

export interface FlatResult extends FlatCounts {
  defaultLocale: string;
  locales: string[];
  rows: FlatRow[];
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
function keysOf(context: FlatContext): JsonObject {
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

/** The text a language file holds at a path; nothing where the file has a namespace or a list instead. */
function textAtPath(
  tree: JsonObject | undefined,
  path: string,
): TranslationValue {
  const value = getValueAtPath(tree, path);
  return Array.isArray(value) || isJsonObject(value) ? undefined : value;
}

function valuesAtPath(
  messages: LocaleMessages,
  locales: string[],
  path: string,
) {
  const values: Record<string, TranslationValue> = {};
  for (const locale of locales) {
    const text = textAtPath(messages[locale], path);
    values[locale] = isMissing(text) ? undefined : text;
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

function issueLocales(context: FlatContext, row: FlatRow): string[] {
  const base = row.values[context.defaultLocale];
  return context.locales.filter((locale) =>
    hasMessageIssue(
      locale === context.defaultLocale ? "" : base,
      row.values[locale],
    ),
  );
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
  const issues = issueLocales(context, row);
  if (issues.length > 0) row.issues = issues;
  return row;
}

/**
 * Whether the text of a language needs another look: it has an issue, or it
 * was translated from an older base text. The rule of every "issues" count:
 * the Language page's figures, its queue and the matrix filter.
 */
export function needsReview(row: FlatRow, locale: string): boolean {
  return (
    (row.issues?.includes(locale) ?? false) ||
    (row.outdated?.includes(locale) ?? false)
  );
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
    localeProgress[locale] = coveragePercent(
      rows.length - missing,
      rows.length,
    );
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
    baseMissing: Object.hasOwn(localeMissing, context.defaultLocale)
      ? localeMissing[context.defaultLocale]
      : 0,
    incompleteKeys: rows.filter((row) =>
      targets.some((locale) => isRowMissing(row, locale)),
    ).length,
  };
}

const WORKSPACE_STAMPS: Record<WorkspaceKind, (workspace: string) => string> = {
  default: registryStamp,
  modules: registryStamp,
  added: (workspace) => filesStamp(workspaceFiles(workspace)),
};

function computeFlat(workspace: string): FlatResult {
  const context = contextOf(workspace);
  const rows = leafPaths(keysOf(context)).map((key) =>
    buildFlatRow(context, key),
  );
  return summarizeRows(context, rows);
}

/**
 * The rows of a workspace and their coverage; default and modules take the
 * base language the server decides. Computed once, then kept until a write
 * or a change of its files or registered modules: every block of a page
 * reads the same result. Shared: callers must not change it.
 */
export function resolveFlat(workspace: string): FlatResult {
  const stamp = WORKSPACE_STAMPS[workspaceKind(workspace)](workspace);
  return memoizeFlat(`flat:${workspace}`, stamp, () => computeFlat(workspace));
}

/** The figures of a workspace a write changes. */
export function flatCounts(workspace: string): FlatCounts {
  const flat = resolveFlat(workspace);
  return {
    localeProgress: flat.localeProgress,
    localeMissing: flat.localeMissing,
    totalKeys: flat.totalKeys,
    baseMissing: flat.baseMissing,
    incompleteKeys: flat.incompleteKeys,
  };
}

/** The current row of one key, as /flat lists it (`undefined` once the key is gone). */
export function resolveRow(
  workspace: string,
  key: string,
): FlatRow | undefined {
  return resolveFlat(workspace).rows.find((row) => row.key === key);
}
