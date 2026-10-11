import { useDmsRouter } from '#dms/frontend-module'
import {
  EMPTY_FILTERS,
  parseFilter,
  type MatrixFilterState,
} from './useMatrixFilters'

type FilterQuery = Record<keyof MatrixFilterState, string>

/** The query names of the filters, kept as before so links into the matrix still work. */
const QUERY_NAMES: FilterQuery = {
  filter: 'filter',
  missingIn: 'missingIn',
  namespace: 'namespace',
  search: 'q',
}
/** Older links name the language to show next to the base `locale`. */
const LANGUAGE_ALIAS = 'locale'
const DEFAULT_FILTER = 'all'
const COLUMNS_STORAGE = 'dms-lang:matrix-columns:'

function filtersOf(
  query: Record<string, string | undefined>,
): MatrixFilterState {
  return {
    filter: parseFilter(query[QUERY_NAMES.filter]),
    missingIn: query[QUERY_NAMES.missingIn] || query[LANGUAGE_ALIAS] || '',
    namespace: query[QUERY_NAMES.namespace] ?? '',
    search: query[QUERY_NAMES.search] ?? '',
  }
}

function queryOf(
  filters: MatrixFilterState,
): Record<string, string | undefined> {
  return {
    [QUERY_NAMES.filter]:
      filters.filter === DEFAULT_FILTER ? undefined : filters.filter,
    [QUERY_NAMES.missingIn]: filters.missingIn || undefined,
    [QUERY_NAMES.namespace]: filters.namespace || undefined,
    [QUERY_NAMES.search]: filters.search.trim() || undefined,
    [LANGUAGE_ALIAS]: undefined,
  }
}

function sameFilters(a: MatrixFilterState, b: MatrixFilterState): boolean {
  return (Object.keys(QUERY_NAMES) as (keyof MatrixFilterState)[]).every(
    (name) => a[name] === b[name],
  )
}

interface StoredColumns {
  shown: string[]
  hidden: string[]
}

function readColumns(workspace: string): StoredColumns | null {
  try {
    const stored = localStorage.getItem(`${COLUMNS_STORAGE}${workspace}`)
    const parsed = stored
      ? (JSON.parse(stored) as Partial<StoredColumns>)
      : null
    if (!Array.isArray(parsed?.shown)) return null
    return {
      shown: parsed.shown.map(String),
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.map(String) : [],
    }
  } catch {
    return null
  }
}

function writeColumns(workspace: string, columns: StoredColumns) {
  try {
    localStorage.setItem(
      `${COLUMNS_STORAGE}${workspace}`,
      JSON.stringify(columns),
    )
  } catch {
    return
  }
}

/**
 * The view of the matrix a user chose: the filters live in the URL (a link
 * or a refresh shows the same keys, Back undoes a filter change made by a
 * link) and the columns shown, in their order, are remembered per workspace
 * in this browser.
 */
export function useMatrixView() {
  const { route } = useWorkspaceRoute()
  const router = useDmsRouter()
  const { selectedWorkspace } = useI18nWorkspaces()
  const { flat } = useWorkspaceFlat()

  const filters = ref<MatrixFilterState>(filtersOf(route.query))
  const order = ref<string[]>([])

  watch(
    () => route.query,
    (query) => {
      const next = filtersOf(query)
      if (!sameFilters(next, filters.value)) filters.value = next
    },
  )

  watch(
    filters,
    (next) => {
      const query = { ...route.query, ...queryOf(next) }
      const link = linkWithQuery(route.path, query)
      const current = linkWithQuery(route.path, route.query)
      if (link !== current) void router.replace(link)
    },
    { deep: true },
  )

  function defaultOrder(codes: string[]): string[] {
    const base = flat.value.defaultLocale
    return [...codes].sort((a, b) => (a === base ? -1 : b === base ? 1 : 0))
  }

  /** The stored columns, then the languages added since (hidden ones stay hidden). */
  function restoreOrder() {
    const codes = flat.value.locales
    const stored = readColumns(selectedWorkspace.value)
    if (!stored) {
      order.value = defaultOrder(codes)
      return
    }
    const known = new Set([...stored.shown, ...stored.hidden])
    order.value = [
      ...stored.shown.filter((code) => codes.includes(code)),
      ...codes.filter((code) => !known.has(code)),
    ]
  }

  function saveOrder(next: string[]) {
    order.value = next
    writeColumns(selectedWorkspace.value, {
      shown: next,
      hidden: flat.value.locales.filter((code) => !next.includes(code)),
    })
  }

  watch(
    () => `${selectedWorkspace.value}|${flat.value.locales.join(',')}`,
    restoreOrder,
    { immediate: true },
  )

  /** Drops filters the workspace cannot have (a language or a namespace it lacks). */
  function sanitize(namespaces: string[]) {
    if (!flat.value.locales.length) return
    const { missingIn, namespace } = filters.value
    const keepsLanguage =
      !missingIn ||
      (flat.value.locales.includes(missingIn) &&
        missingIn !== flat.value.defaultLocale)
    const keepsNamespace = !namespace || namespaces.includes(namespace)
    if (keepsLanguage && keepsNamespace) return
    filters.value = {
      ...filters.value,
      missingIn: keepsLanguage ? missingIn : '',
      namespace: keepsNamespace ? namespace : '',
    }
  }

  function resetFilters() {
    filters.value = { ...EMPTY_FILTERS }
  }

  return { filters, order, saveOrder, sanitize, resetFilters }
}
