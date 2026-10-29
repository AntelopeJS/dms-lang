import type {
  FlatTranslationRow,
  FlatTranslations,
  LanguageCoverage,
  NamespaceCoverage,
} from '../types/lang'
import {
  isRowValueMissing,
  NAMESPACE_SEPARATOR,
  namespaceOf,
} from './translations'

const FULL_COVERAGE = 100

export const HIGH_COVERAGE = 90
export const MID_COVERAGE = 60

export const EMPTY_FLAT: FlatTranslations = {
  defaultLocale: '',
  locales: [],
  rows: [],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 0,
  baseMissing: 0,
  incompleteKeys: 0,
}

/**
 * The share of `total` that is translated, in whole percent rounded down, so
 * that one missing text keeps it under 100 (200 of 201 reads 99). Nothing to
 * translate reads 100. The rule the server rounds every coverage with.
 */
export function coveragePercent(translated: number, total: number): number {
  if (total <= 0) return FULL_COVERAGE
  return Math.floor((Math.max(translated, 0) * FULL_COVERAGE) / total)
}

export function coverageTone(
  coverage: number,
): 'success' | 'warning' | 'error' {
  if (coverage >= HIGH_COVERAGE) return 'success'
  if (coverage >= MID_COVERAGE) return 'warning'
  return 'error'
}

export function translatedCount(
  rows: FlatTranslationRow[],
  locale: string,
): number {
  return rows.filter((row) => !isRowValueMissing(row, locale)).length
}

/** The coverage of each language, from the figures the server keeps. */
export function languageCoverage(
  flat: FlatTranslations,
  nameOf: (code: string) => string,
): LanguageCoverage[] {
  return flat.locales.map((code) => {
    const missing = flat.localeMissing[code] ?? 0
    const translated = flat.totalKeys - missing
    return {
      code,
      name: nameOf(code),
      isBase: code === flat.defaultLocale,
      coverage: coveragePercent(translated, flat.totalKeys),
      translated,
      missing,
    }
  })
}

function groupByNamespace(
  rows: FlatTranslationRow[],
): Map<string, FlatTranslationRow[]> {
  const groups = new Map<string, FlatTranslationRow[]>()
  for (const row of rows) {
    const namespace = namespaceOf(row.key)
    const group = groups.get(namespace)
    if (group) group.push(row)
    else groups.set(namespace, [row])
  }
  return groups
}

export function namespaceCoverage(
  rows: FlatTranslationRow[],
  locales: string[],
): NamespaceCoverage[] {
  return [...groupByNamespace(rows)].map(([namespace, group]) => {
    const coverage: Record<string, number> = {}
    const missing: Record<string, number> = {}
    for (const locale of locales) {
      const translated = translatedCount(group, locale)
      coverage[locale] = coveragePercent(translated, group.length)
      missing[locale] = group.length - translated
    }
    return { namespace, keys: group.length, coverage, missing }
  })
}

/** Where a key put back before `before` (a sibling key or namespace) goes: the end when none is there. */
function insertionIndex(rows: FlatTranslationRow[], before?: string): number {
  if (before === undefined) return rows.length
  const index = rows.findIndex(
    (entry) =>
      entry.key === before ||
      entry.key.startsWith(`${before}${NAMESPACE_SEPARATOR}`),
  )
  return index < 0 ? rows.length : index
}

/**
 * The translations with one row put in place: replaced, added (before the
 * `before` sibling, else at the end), or taken out when there is none (the
 * key is gone). The other rows are kept as they are.
 */
export function withRow(
  flat: FlatTranslations,
  key: string,
  row: FlatTranslationRow | undefined,
  before?: string,
): FlatTranslations {
  const index = flat.rows.findIndex((entry) => entry.key === key)
  const rows = [...flat.rows]
  if (row && index >= 0) rows[index] = row
  else if (row) rows.splice(insertionIndex(rows, before), 0, row)
  else if (index >= 0) rows.splice(index, 1)
  return { ...flat, rows }
}

export const COVERAGE_TEXT_CLASSES: Record<
  'success' | 'warning' | 'error',
  string
> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}
