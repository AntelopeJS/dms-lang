import { FALLBACK_LOCALE, listAllWorkspaces } from "./catalog";
import { type FlatResult, resolveFlat } from "./resolve";
import { isMissing } from "./tree";
import {
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  type WorkspaceSummary,
} from "./workspaces";

export interface WorkspaceStats extends WorkspaceSummary {
  baseLocale: string;
  totalKeys: number;
  translatedStrings: number;
  missing: number;
  coverage: number;
  localeProgress: Record<string, number>;
  localeMissing: Record<string, number>;
  overrides: number;
}

function countTranslated(flat: FlatResult): number {
  return flat.rows.reduce(
    (total, row) =>
      total +
      flat.locales.filter((locale) => !isMissing(row.values[locale])).length,
    0,
  );
}

function countOverrides(flat: FlatResult): number {
  return flat.rows.filter((row) => row.overridden === true).length;
}

function targetLocales(flat: FlatResult): string[] {
  return flat.locales.filter((locale) => locale !== flat.defaultLocale);
}

function averageCoverage(flat: FlatResult): number {
  const targets = targetLocales(flat);
  if (targets.length === 0) return 100;
  const sum = targets.reduce(
    (total, locale) => total + (flat.localeProgress[locale] ?? 0),
    0,
  );
  return Math.round(sum / targets.length);
}

function sumMissing(flat: FlatResult): number {
  return targetLocales(flat).reduce(
    (total, locale) => total + (flat.localeMissing[locale] ?? 0),
    0,
  );
}

function describeWorkspace(
  workspace: WorkspaceSummary,
  fallbackLocale: string,
): WorkspaceStats {
  const flat = resolveFlat(workspace.id, fallbackLocale);
  return {
    ...workspace,
    baseLocale: flat.defaultLocale,
    totalKeys: flat.totalKeys,
    translatedStrings: countTranslated(flat),
    missing: sumMissing(flat),
    coverage: averageCoverage(flat),
    localeProgress: flat.localeProgress,
    localeMissing: flat.localeMissing,
    overrides: countOverrides(flat),
  };
}

function shareOverrides(stats: WorkspaceStats[]): WorkspaceStats[] {
  const overrides =
    stats.find((workspace) => workspace.id === MODULES_WORKSPACE)?.overrides ??
    0;
  return stats.map((workspace) =>
    workspace.id === DEFAULT_WORKSPACE
      ? { ...workspace, overrides }
      : workspace,
  );
}

export function summarizeWorkspaces(
  fallbackLocale: string = FALLBACK_LOCALE,
): WorkspaceStats[] {
  return shareOverrides(
    listAllWorkspaces().map((workspace) =>
      describeWorkspace(workspace, fallbackLocale),
    ),
  );
}

export function countDefaultMissing(): number {
  return sumMissing(resolveFlat(DEFAULT_WORKSPACE, FALLBACK_LOCALE));
}
