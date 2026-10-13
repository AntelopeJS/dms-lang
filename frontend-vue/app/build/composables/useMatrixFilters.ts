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
  /** The language being translated: the matrix shows it next to the base only. */
  missingIn: string
  namespace: string
  search: string
}

export type MatrixCounts = Record<TranslationFilter, number> & {
  /** Empty cells of the counted languages: the missing translations. */
  cells: number
}

interface RowStatus {
  missing: string[]
  hasIssue: boolean
}

const FILTERS: TranslationFilter[] = ['all', 'missing', 'complete', 'issues']

export const EMPTY_FILTERS: MatrixFilterState = {
  filter: 'all',
  missingIn: '',
  namespace: '',
  search: '',
}

export function parseFilter(value: string | undefined): TranslationFilter {
  return FILTERS.find((filter) => filter === value) ?? 'all'
}

/**
 * The languages the counts and the filters look at: the one being translated,
 * else the target languages shown as columns, else every target language.
 */
export function targetLocales(
  flat: FlatTranslations,
  missingIn: string,
  shown: string[],
): string[] {
  if (missingIn && flat.locales.includes(missingIn)) return [missingIn]
  const targets = flat.locales.filter((code) => code !== flat.defaultLocale)
  const visible = targets.filter((code) => shown.includes(code))
  return visible.length ? visible : targets
}

function rowStatus(
  row: FlatTranslationRow,
  base: string,
  targets: string[],
): RowStatus {
  const missing = targets.filter((code) => isRowValueMissing(row, code))
  const hasIssue =
    isRowValueMissing(row, base) ||
    (row.issues?.includes(base) ?? false) ||
    targets.some((code) => needsReview(row, code))
  return { missing, hasIssue }
}

function searchText(row: FlatTranslationRow): string {
  const values = Object.values(row.values).map(stringValue)
  return [row.key, ...values].join('\n').toLowerCase()
}

function countRows(
  rows: FlatTranslationRow[],
  statusOf: (row: FlatTranslationRow) => RowStatus,
): MatrixCounts {
  const counts: MatrixCounts = {
    all: rows.length,
    missing: 0,
    complete: 0,
    issues: 0,
    cells: 0,
  }
  for (const row of rows) {
    const status = statusOf(row)
    counts.cells += status.missing.length
    if (status.missing.length) counts.missing += 1
    else counts.complete += 1
    if (status.hasIssue) counts.issues += 1
  }
  return counts
}

type RowPredicate = (row: FlatTranslationRow) => boolean

const NO_STATUS: RowStatus = { missing: [], hasIssue: false }

function useRowStatuses(
  flat: Ref<FlatTranslations>,
  state: Ref<MatrixFilterState>,
  shown: Ref<string[]>,
) {
  const targets = computed(() =>
    targetLocales(flat.value, state.value.missingIn, shown.value),
  )
  const statuses = computed(() => {
    const base = flat.value.defaultLocale
    return new Map(
      flat.value.rows.map((row) => [
        row.key,
        rowStatus(row, base, targets.value),
      ]),
    )
  })
  const statusOf = (row: FlatTranslationRow): RowStatus =>
    statuses.value.get(row.key) ?? NO_STATUS
  const isRowMissing = (row: FlatTranslationRow): boolean =>
    statusOf(row).missing.length > 0
  const predicates: Record<TranslationFilter, RowPredicate> = {
    all: () => true,
    missing: isRowMissing,
    complete: (row) => !isRowMissing(row),
    issues: (row) => statusOf(row).hasIssue,
  }
  return { targets, statusOf, isRowMissing, predicates }
}

function useScopedRows(
  flat: Ref<FlatTranslations>,
  state: Ref<MatrixFilterState>,
) {
  const haystacks = computed(
    () => new Map(flat.value.rows.map((row) => [row.key, searchText(row)])),
  )
  const namespaces = computed(() => [
    ...new Set(flat.value.rows.map((row) => namespaceOf(row.key))),
  ])
  const namespace = computed(() =>
    namespaces.value.includes(state.value.namespace)
      ? state.value.namespace
      : '',
  )
  const scoped = computed(() => {
    const needle = state.value.search.trim().toLowerCase()
    return flat.value.rows.filter(
      (row) =>
        (!namespace.value || namespaceOf(row.key) === namespace.value) &&
        (!needle || haystacks.value.get(row.key)?.includes(needle)),
    )
  })
  return { namespaces, scoped }
}

/**
 * Which keys the matrix shows, and how many each filter would show. A key
 * listed in `pinned` stays shown after it stops matching (a translation just
 * saved), until the filters change: rows never move under the user's hands.
 */
export function useMatrixFilters(
  flat: Ref<FlatTranslations>,
  state: Ref<MatrixFilterState>,
  shown: Ref<string[]>,
  pinned: Ref<Set<string>>,
) {
  const { targets, statusOf, isRowMissing, predicates } = useRowStatuses(
    flat,
    state,
    shown,
  )
  const { namespaces, scoped } = useScopedRows(flat, state)
  const matches = (row: FlatTranslationRow) =>
    predicates[state.value.filter](row)
  const rows = computed(() =>
    scoped.value.filter((row) => matches(row) || pinned.value.has(row.key)),
  )

  return {
    rows,
    groups: computed(() => groupRows(rows.value, isRowMissing)),
    counts: computed(() => countRows(scoped.value, statusOf)),
    targets,
    namespaces,
    isRowDone: (row: FlatTranslationRow) =>
      pinned.value.has(row.key) && !matches(row),
  }
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
