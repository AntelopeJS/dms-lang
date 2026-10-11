import { listAllWorkspaces } from "./catalog";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import { coveragePercent, FULL_COVERAGE } from "./coverage";
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
  targets: number;
  baseMissing: number;
  incompleteKeys: number;
  localeProgress: Record<string, number>;
  localeMissing: Record<string, number>;
  overrides: number;
  publicUrl?: string;
}

/** The public URL template of a workspace, `undefined` when it is not served publicly. */
export type PublicUrlOf = (workspace: string) => string | undefined;

export function countTranslated(flat: FlatResult): number {
  return flat.rows.reduce(
    (total, row) =>
      total +
      flat.locales.filter((locale) => !isRowMissing(row, locale)).length,
    0,
  );
}

function countOverrides(flat: FlatResult): number {
  return flat.rows.filter((row) => row.overridden === true).length;
}

export function targetLocales(flat: FlatResult): string[] {
  return flat.locales.filter((locale) => locale !== flat.defaultLocale);
}

export function sumMissing(flat: FlatResult): number {
  return targetLocales(flat).reduce(
    (total, locale) => total + (flat.localeMissing[locale] ?? 0),
    0,
  );
}

/**
 * The coverage of the target languages: the share of their texts that exist.
 * Every language has the same keys, so it is also the mean of their exact
 * coverages, rounded once by {@link coveragePercent}. `undefined` when there
 * is nothing to cover: no target language or no key.
 */
export function targetCoverage(flat: FlatResult): number | undefined {
  const expected = targetLocales(flat).length * flat.totalKeys;
  if (expected === 0) return undefined;
  return coveragePercent(expected - sumMissing(flat), expected);
}

function describeWorkspace(
  workspace: WorkspaceSummary,
  publicUrlOf?: PublicUrlOf,
): WorkspaceStats {
  const flat = resolveFlat(workspace.id);
  const stats: WorkspaceStats = {
    ...workspace,
    baseLocale: flat.defaultLocale,
    totalKeys: flat.totalKeys,
    translatedStrings: countTranslated(flat),
    missing: sumMissing(flat),
    coverage: targetCoverage(flat) ?? FULL_COVERAGE,
    targets: targetLocales(flat).length,
    baseMissing: flat.baseMissing,
    incompleteKeys: flat.incompleteKeys,
    localeProgress: flat.localeProgress,
    localeMissing: flat.localeMissing,
    overrides: countOverrides(flat),
  };
  const publicUrl = publicUrlOf?.(workspace.id);
  if (publicUrl !== undefined) stats.publicUrl = publicUrl;
  return stats;
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
  publicUrlOf?: PublicUrlOf,
): WorkspaceStats[] {
  return shareOverrides(
    listAllWorkspaces().map((workspace) =>
      describeWorkspace(workspace, publicUrlOf),
    ),
  );
}

export function countDefaultMissing(): number {
  return sumMissing(resolveFlat(DEFAULT_WORKSPACE));
}
