import type {
  FlatTranslationRow,
  FlatTranslations,
  LanguageCoverage,
  NamespaceCoverage,
} from '../types/lang'

type LocaleFallback = string | string[] | Record<string, string[]> | false

const FULL_COVERAGE = 100
const DEFAULT_LOCALE = 'en'
const NAMESPACE_SEPARATOR = '.'
const PLACEHOLDER_PATTERN = /\{\s*([\w.-]+)\s*\}/g
export const HIGH_COVERAGE = 90
export const MID_COVERAGE = 60

export const EMPTY_FLAT: FlatTranslations = {
  defaultLocale: '',
  locales: [],
  rows: [],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 0,
}

export function isLocaleValueMissing(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * Whether a key has no text in a language, counting the value an installed
 * module gives it in the project files: that one shows on screen too.
 */
export function isRowValueMissing(
  row: FlatTranslationRow,
  locale: string,
): boolean {
  return (
    isLocaleValueMissing(row.values[locale]) &&
    isLocaleValueMissing(row.inherited?.[locale])
  )
}

export function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

export function namespaceOf(key: string): string {
  const index = key.indexOf(NAMESPACE_SEPARATOR)
  return index < 0 ? key : key.slice(0, index)
}

export function placeholdersOf(text: unknown): string[] {
  const found = new Set<string>()
  for (const match of stringValue(text).matchAll(PLACEHOLDER_PATTERN)) {
    found.add(match[1])
  }
  return [...found]
}

/** Placeholders of the base text the translation leaves out. */
export function missingPlaceholders(base: unknown, value: unknown): string[] {
  if (isLocaleValueMissing(value)) return []
  const present = new Set(placeholdersOf(value))
  return placeholdersOf(base).filter((name) => !present.has(name))
}

export function rowHasIssue(
  row: FlatTranslationRow,
  baseLocale: string,
  locale: string,
): boolean {
  if (locale === baseLocale) return false
  return (
    missingPlaceholders(row.values[baseLocale], row.values[locale]).length > 0
  )
}

export function coveragePercent(translated: number, total: number): number {
  if (total === 0) return FULL_COVERAGE
  return Math.round((translated / total) * FULL_COVERAGE)
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

export function languageCoverage(
  flat: FlatTranslations,
  nameOf: (code: string) => string,
): LanguageCoverage[] {
  return flat.locales.map((code) => {
    const translated = translatedCount(flat.rows, code)
    return {
      code,
      name: nameOf(code),
      isBase: code === flat.defaultLocale,
      coverage: coveragePercent(translated, flat.rows.length),
      translated,
      missing: flat.rows.length - translated,
    }
  })
}

function groupByNamespace(
  rows: FlatTranslationRow[],
): Map<string, FlatTranslationRow[]> {
  const groups = new Map<string, FlatTranslationRow[]>()
  for (const row of rows) {
    const namespace = namespaceOf(row.key)
    groups.set(namespace, [...(groups.get(namespace) ?? []), row])
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

export function namespaceCount(rows: FlatTranslationRow[]): number {
  return new Set(rows.map((row) => namespaceOf(row.key))).size
}

export function cloneFlat(flat: FlatTranslations): FlatTranslations {
  return {
    ...flat,
    locales: [...flat.locales],
    rows: flat.rows.map((row) => ({
      ...row,
      values: { ...row.values },
      inherited: row.inherited ? { ...row.inherited } : undefined,
    })),
    localeProgress: { ...flat.localeProgress },
    localeMissing: { ...flat.localeMissing },
  }
}

/** Recomputes the counts a local edit changes, as the server would. */
export function refreshCounts(flat: FlatTranslations): FlatTranslations {
  const localeProgress: Record<string, number> = {}
  const localeMissing: Record<string, number> = {}
  for (const locale of flat.locales) {
    const translated = translatedCount(flat.rows, locale)
    const isBase = locale === flat.defaultLocale
    localeProgress[locale] = isBase
      ? FULL_COVERAGE
      : coveragePercent(translated, flat.rows.length)
    localeMissing[locale] = isBase ? 0 : flat.rows.length - translated
  }
  return { ...flat, localeProgress, localeMissing, totalKeys: flat.rows.length }
}

export const COVERAGE_TEXT_CLASSES: Record<
  'success' | 'warning' | 'error',
  string
> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

/** Placeholder names written as they appear in a text: `{name} {count}`. */
export function formatTokens(names: string[]): string {
  return names.map((name) => `{${name}}`).join(' ')
}

/** The first language of a vue-i18n fallback chain: the base of the project files. */
export function resolveDefaultLocale(fallback: LocaleFallback): string {
  if (typeof fallback === 'string') return fallback
  if (Array.isArray(fallback)) return fallback[0] ?? DEFAULT_LOCALE
  return (fallback && fallback.default?.[0]) || DEFAULT_LOCALE
}
