import { getLocaleCodes, loadMessages } from "./registry";
import {
  buildTranslationData,
  collectLeafPaths,
  deepMerge,
  extractTranslationsByPath,
  FULL_PROGRESS,
  getValueAtPath,
  isMissing,
  type LocaleMessages,
  PROGRESS_PRECISION_FACTOR,
  type TranslationData,
  type TranslationValue,
} from "./tree";
import {
  ALL_WORKSPACE,
  DEFAULT_WORKSPACE,
  getWorkspaceManifest,
  listWorkspaces,
  loadWorkspaceMessages,
  MODULES_WORKSPACE,
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

export interface ByPathResult {
  translations: Record<string, TranslationValue>;
  inherited?: Record<string, TranslationValue>;
}

interface WorkspaceResolver {
  data(workspace: string, fallbackDefaultLocale: string): TranslationData;
  byPath(workspace: string, path: string): ByPathResult;
}

function unionKeys(messages: LocaleMessages): Record<string, unknown> {
  let union: Record<string, unknown> = {};
  for (const localeMessages of Object.values(messages)) {
    union = deepMerge(union, localeMessages);
  }
  return union;
}

function mergedPresence(
  own: LocaleMessages,
  external: LocaleMessages,
): LocaleMessages {
  const presence: LocaleMessages = {};
  for (const locale of getLocaleCodes("own")) {
    presence[locale] = deepMerge(external[locale] ?? {}, own[locale] ?? {});
  }
  return presence;
}

function ownData(
  _workspace: string,
  fallbackDefaultLocale: string,
): TranslationData {
  const own = loadMessages("own");
  const external = loadMessages("external");
  const presence = mergedPresence(own, external);
  const structure = { [fallbackDefaultLocale]: unionKeys(own) };
  return buildTranslationData(structure, fallbackDefaultLocale, presence);
}

function ownByPath(_workspace: string, path: string): ByPathResult {
  const own = loadMessages("own");
  const external = loadMessages("external");
  const translations: Record<string, TranslationValue> = {};
  const inherited: Record<string, TranslationValue> = {};
  for (const locale of getLocaleCodes("own")) {
    translations[locale] = getValueAtPath(
      own[locale],
      path,
    ) as TranslationValue;
    inherited[locale] = getValueAtPath(
      external[locale],
      path,
    ) as TranslationValue;
  }
  return { translations, inherited };
}

function modulesData(
  _workspace: string,
  fallbackDefaultLocale: string,
): TranslationData {
  const external = loadMessages("external");
  const defaultLocale = external[fallbackDefaultLocale]
    ? fallbackDefaultLocale
    : (Object.keys(external)[0] ?? fallbackDefaultLocale);
  return buildTranslationData(external, defaultLocale);
}

function modulesByPath(_workspace: string, path: string): ByPathResult {
  return {
    translations: extractTranslationsByPath(loadMessages("external"), path),
  };
}

function addedData(workspace: string): TranslationData {
  const manifest = getWorkspaceManifest(workspace);
  return buildTranslationData(
    loadWorkspaceMessages(workspace),
    manifest.defaultLocale,
  );
}

function addedByPath(workspace: string, path: string): ByPathResult {
  return {
    translations: extractTranslationsByPath(
      loadWorkspaceMessages(workspace),
      path,
    ),
  };
}

const RESOLVERS: Record<WorkspaceKind, WorkspaceResolver> = {
  default: { data: ownData, byPath: ownByPath },
  modules: { data: modulesData, byPath: modulesByPath },
  added: { data: addedData, byPath: addedByPath },
};

export function resolveTranslationData(
  workspace: string,
  fallbackDefaultLocale: string,
): TranslationData {
  return RESOLVERS[workspaceKind(workspace)].data(
    workspace,
    fallbackDefaultLocale,
  );
}

export function resolveTranslationsByPath(
  workspace: string,
  path: string,
): ByPathResult {
  return RESOLVERS[workspaceKind(workspace)].byPath(workspace, path);
}

export interface FlatRow {
  key: string;
  values: Record<string, TranslationValue>;
  inherited?: Record<string, TranslationValue>;
}

export interface FlatResult {
  defaultLocale: string;
  locales: string[];
  rows: FlatRow[];
  localeProgress: Record<string, number>;
  localeMissing: Record<string, number>;
  totalKeys: number;
}

interface FlatContext {
  defaultLocale: string;
  locales: string[];
  presence: LocaleMessages;
  inherited?: LocaleMessages;
}

function ownFlatContext(
  _workspace: string,
  fallbackDefaultLocale: string,
): FlatContext {
  return {
    defaultLocale: fallbackDefaultLocale,
    locales: getLocaleCodes("own"),
    presence: loadMessages("own"),
    inherited: loadMessages("external"),
  };
}

function modulesFlatContext(
  _workspace: string,
  fallbackDefaultLocale: string,
): FlatContext {
  const external = loadMessages("external");
  const defaultLocale = external[fallbackDefaultLocale]
    ? fallbackDefaultLocale
    : (Object.keys(external)[0] ?? fallbackDefaultLocale);
  return {
    defaultLocale,
    locales: getLocaleCodes("external"),
    presence: external,
  };
}

function addedFlatContext(workspace: string): FlatContext {
  const manifest = getWorkspaceManifest(workspace);
  return {
    defaultLocale: manifest.defaultLocale,
    locales: manifest.locales.map((locale) => locale.code),
    presence: loadWorkspaceMessages(workspace),
  };
}

const FLAT_CONTEXTS: Record<
  WorkspaceKind,
  (workspace: string, fallbackDefaultLocale: string) => FlatContext
> = {
  default: ownFlatContext,
  modules: modulesFlatContext,
  added: addedFlatContext,
};

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

function computeLocaleMissing(
  rows: FlatRow[],
  locales: string[],
  defaultLocale: string,
): Record<string, number> {
  const localeMissing: Record<string, number> = {};
  for (const locale of locales) {
    if (locale === defaultLocale) {
      localeMissing[locale] = 0;
      continue;
    }
    let missing = 0;
    for (const row of rows) {
      if (isMissing(row.values[locale])) missing += 1;
    }
    localeMissing[locale] = missing;
  }
  return localeMissing;
}

export function resolveFlat(
  workspace: string,
  fallbackDefaultLocale: string,
): FlatResult {
  const data = resolveTranslationData(workspace, fallbackDefaultLocale);
  const context = FLAT_CONTEXTS[workspaceKind(workspace)](
    workspace,
    fallbackDefaultLocale,
  );

  const rows: FlatRow[] = collectLeafPaths(data.tree).map((key) => {
    const row: FlatRow = {
      key,
      values: valuesAtPath(context.presence, context.locales, key),
    };
    if (context.inherited) {
      row.inherited = valuesAtPath(context.inherited, context.locales, key);
    }
    return row;
  });

  const localeMissing = computeLocaleMissing(
    rows,
    context.locales,
    context.defaultLocale,
  );

  return {
    defaultLocale: context.defaultLocale,
    locales: context.locales,
    rows,
    localeProgress: data.localeProgress,
    localeMissing,
    totalKeys: data.totalKeys,
  };
}

export function resolveAggregatedFlat(
  fallbackDefaultLocale: string,
): FlatResult {
  const ids = [
    DEFAULT_WORKSPACE,
    MODULES_WORKSPACE,
    ...listWorkspaces().map((workspace) => workspace.id),
  ];
  const parts = ids.map((id) => resolveFlat(id, fallbackDefaultLocale));

  const defaultLocale = parts[0]?.defaultLocale || fallbackDefaultLocale;

  const rows: FlatRow[] = [];
  const expected: Record<string, number> = {};
  const existing: Record<string, number> = {};
  const localeMissing: Record<string, number> = {};
  let totalKeys = 0;

  for (const part of parts) {
    totalKeys += part.totalKeys;
    for (const row of part.rows) rows.push(row);
    for (const locale of part.locales) {
      const missing = part.localeMissing[locale] ?? 0;
      expected[locale] = (expected[locale] ?? 0) + part.totalKeys;
      existing[locale] = (existing[locale] ?? 0) + (part.totalKeys - missing);
      localeMissing[locale] = (localeMissing[locale] ?? 0) + missing;
    }
  }

  const localeProgress: Record<string, number> = {};
  for (const locale of Object.keys(expected)) {
    const expectedKeys = expected[locale] ?? 0;
    localeProgress[locale] =
      expectedKeys > 0
        ? Math.round(
            (existing[locale] / expectedKeys) * PROGRESS_PRECISION_FACTOR,
          ) / FULL_PROGRESS
        : 0;
  }

  if (defaultLocale) {
    localeProgress[defaultLocale] = FULL_PROGRESS;
    localeMissing[defaultLocale] = 0;
  }

  return {
    defaultLocale,
    locales: Object.keys(expected).sort(),
    rows,
    localeProgress,
    localeMissing,
    totalKeys,
  };
}
