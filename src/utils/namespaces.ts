import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import { targetLocales } from "./summary";

const NAMESPACE_SEPARATOR = ".";

/** One namespace of a workspace: its keys and how many each target language lacks. */
interface NamespaceRow {
  namespace: string;
  keys: number;
  missing: Record<string, number>;
}

/**
 * The coverage of a workspace by namespace and target language (the overview
 * heatmap): the targets least complete first, the namespaces with the largest
 * share of missing texts first.
 */
export interface NamespaceCoverage {
  locales: string[];
  localeMissing: Record<string, number>;
  namespaces: NamespaceRow[];
}

function namespaceOf(key: string): string {
  const index = key.indexOf(NAMESPACE_SEPARATOR);
  return index < 0 ? key : key.slice(0, index);
}

function sortedTargets(flat: FlatResult): string[] {
  const missingOf = (code: string) => flat.localeMissing[code] ?? 0;
  const progressOf = (code: string) => flat.localeProgress[code] ?? 0;
  return targetLocales(flat).sort(
    (left, right) =>
      progressOf(left) - progressOf(right) ||
      missingOf(right) - missingOf(left) ||
      left.localeCompare(right),
  );
}

function emptyRow(namespace: string, locales: string[]): NamespaceRow {
  const missing = Object.fromEntries(locales.map((locale) => [locale, 0]));
  return { namespace, keys: 0, missing };
}

function countNamespaces(flat: FlatResult, locales: string[]): NamespaceRow[] {
  const rows = new Map<string, NamespaceRow>();
  for (const row of flat.rows) {
    const namespace = namespaceOf(row.key);
    const entry = rows.get(namespace) ?? emptyRow(namespace, locales);
    rows.set(namespace, entry);
    entry.keys += 1;
    for (const locale of locales)
      if (isRowMissing(row, locale)) entry.missing[locale] += 1;
  }
  return [...rows.values()];
}

function totalMissing(entry: NamespaceRow): number {
  return Object.values(entry.missing).reduce((sum, count) => sum + count, 0);
}

function compareNamespaces(left: NamespaceRow, right: NamespaceRow): number {
  return (
    totalMissing(right) / right.keys - totalMissing(left) / left.keys ||
    totalMissing(right) - totalMissing(left) ||
    left.namespace.localeCompare(right.namespace)
  );
}

/** The namespace × target language coverage of a workspace. */
export function namespaceCoverage(workspace: string): NamespaceCoverage {
  const flat = resolveFlat(workspace);
  const locales = sortedTargets(flat);
  return {
    locales,
    localeMissing: flat.localeMissing,
    namespaces: countNamespaces(flat, locales).sort(compareNamespaces),
  };
}
