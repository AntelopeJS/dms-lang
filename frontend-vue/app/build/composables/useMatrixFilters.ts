import type { Ref } from 'vue'
import type {
  FlatTranslationRow,
  FlatTranslations,
  TranslationFilter,
} from '../../types/lang'

export interface MatrixGroup {
  namespace: string
  keys: number
  missing: number
  rows: FlatTranslationRow[]
}

export interface MatrixFilterState {
  filter: TranslationFilter
  missingIn: string
  namespace: string
  search: string
}

const FILTERS: TranslationFilter[] = ['all', 'missing', 'complete', 'issues']

export function parseFilter(value: string | undefined): TranslationFilter {
  return FILTERS.find((filter) => filter === value) ?? 'all'
}

function targetLocales(flat: FlatTranslations, missingIn: string): string[] {
  if (missingIn) return [missingIn]
  return flat.locales.filter((code) => code !== flat.defaultLocale)
}

/** Which keys the matrix shows, and how many each filter would show. */
export function useMatrixFilters(
  flat: Ref<FlatTranslations>,
  state: Ref<MatrixFilterState>,
) {
  const targets = computed(() =>
    targetLocales(flat.value, state.value.missingIn),
  )

  function isRowMissing(row: FlatTranslationRow): boolean {
    return targets.value.some((code) => isRowValueMissing(row, code))
  }

  function hasRowIssue(row: FlatTranslationRow): boolean {
    return targets.value.some((code) =>
      rowHasIssue(row, flat.value.defaultLocale, code),
    )
  }

  const PREDICATES: Record<
    TranslationFilter,
    (row: FlatTranslationRow) => boolean
  > = {
    all: () => true,
    missing: isRowMissing,
    complete: (row) => !isRowMissing(row),
    issues: hasRowIssue,
  }

  const scoped = computed(() => {
    const needle = state.value.search.trim().toLowerCase()
    return flat.value.rows.filter(
      (row) =>
        (!state.value.namespace ||
          namespaceOf(row.key) === state.value.namespace) &&
        (!needle || matchesSearch(row, needle)),
    )
  })

  const counts = computed(() => {
    const result = {} as Record<TranslationFilter, number>
    for (const filter of FILTERS) {
      result[filter] = scoped.value.filter(PREDICATES[filter]).length
    }
    return result
  })

  const rows = computed(() =>
    scoped.value.filter(PREDICATES[state.value.filter]),
  )

  const namespaces = computed(() => [
    ...new Set(flat.value.rows.map((row) => namespaceOf(row.key))),
  ])

  return { rows, counts, namespaces, isRowMissing, hasRowIssue }
}

function matchesSearch(row: FlatTranslationRow, needle: string): boolean {
  if (row.key.toLowerCase().includes(needle)) return true
  return Object.values(row.values).some((value) =>
    stringValue(value).toLowerCase().includes(needle),
  )
}

export function groupRows(
  rows: FlatTranslationRow[],
  isRowMissing: (row: FlatTranslationRow) => boolean,
): MatrixGroup[] {
  const groups = new Map<string, MatrixGroup>()
  for (const row of rows) {
    const namespace = namespaceOf(row.key)
    const group = groups.get(namespace) ?? {
      namespace,
      keys: 0,
      missing: 0,
      rows: [],
    }
    group.keys += 1
    if (isRowMissing(row)) group.missing += 1
    group.rows.push(row)
    groups.set(namespace, group)
  }
  return [...groups.values()]
}
