import { listAllWorkspaces } from "./catalog";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import { FULL_PROGRESS } from "./tree";
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

const ALMOST_FULL = FULL_PROGRESS - 1;

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
 * The mean coverage of the target languages, rounded down and never 100 while a text is
 * missing. 100 without any target language: check {@link targetLocales} to show "—" instead.
 */
export function averageCoverage(flat: FlatResult): number {
  const targets = targetLocales(flat);
  if (targets.length === 0) return FULL_PROGRESS;
  const sum = targets.reduce(
    (total, locale) => total + (flat.localeProgress[locale] ?? 0),
    0,
  );
  const coverage = Math.floor(sum / targets.length);
  return sumMissing(flat) > 0 ? Math.min(coverage, ALMOST_FULL) : coverage;
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
    coverage: averageCoverage(flat),
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
