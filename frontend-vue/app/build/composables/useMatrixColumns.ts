import { computed, type Ref } from 'vue'
import type { FlatTranslations, LanguageCoverage } from '../../types/lang'
import { languageCoverage } from '../../utils/coverage.ts'
import type { MatrixFilterState } from './useMatrixFilters'

const KEY_COLUMN_REM = 16
const LANGUAGE_COLUMN_REM = 15
const TODO_COLUMN_REM = 28

/** What the matrix columns are drawn from. */
export interface MatrixColumnSources {
  flat: Ref<FlatTranslations>
  filters: Ref<MatrixFilterState>
  /** The saved order of the language columns. */
  order: Readonly<Ref<string[]>>
  isCompact: Readonly<Ref<boolean>>
  /** The name of a language among the workspace's languages. */
  nameAmong: (code: string, codes: string[]) => string
  fullName: (code: string) => string
}

/**
 * The language columns of the matrix: every language in the saved order, or
 * the base next to the language being translated (the one chosen, or the
 * first after the base on a compact screen).
 */
export function useMatrixColumns(sources: MatrixColumnSources) {
  const { flat, filters, order, isCompact, nameAmong, fullName } = sources
  const languages = computed<LanguageCoverage[]>(() =>
    languageCoverage(flat.value, (code) => nameAmong(code, flat.value.locales)),
  )
  const languageByCode = computed(
    () => new Map(languages.value.map((entry) => [entry.code, entry])),
  )
  const targetLanguages = computed(() =>
    languages.value
      .filter((entry) => !entry.isBase)
      .map((entry) => ({ code: entry.code, name: fullName(entry.code) })),
  )
  const todoLanguage = computed(() => {
    const chosen = filters.value.missingIn
    if (chosen && flat.value.locales.includes(chosen)) return chosen
    if (!isCompact.value) return ''
    const base = flat.value.defaultLocale
    return order.value.find((code) => code !== base) ?? ''
  })
  const columnCodes = computed(() => {
    if (!todoLanguage.value) return order.value
    const base = flat.value.defaultLocale
    return [base, todoLanguage.value].filter((code) =>
      flat.value.locales.includes(code),
    )
  })
  const columns = computed(() =>
    columnCodes.value
      .map((code) => languageByCode.value.get(code))
      .filter((entry): entry is LanguageCoverage => Boolean(entry)),
  )
  const columnSiblings = computed(() =>
    columns.value.map((entry) => entry.code),
  )
  const compactColumn = computed(() => columns.value.at(-1))
  const tableMinWidth = computed(() => {
    const column = todoLanguage.value ? TODO_COLUMN_REM : LANGUAGE_COLUMN_REM
    return `${KEY_COLUMN_REM + columns.value.length * column}rem`
  })
  return {
    languages,
    languageByCode,
    targetLanguages,
    todoLanguage,
    columnCodes,
    columns,
    columnSiblings,
    compactColumn,
    tableMinWidth,
  }
}
