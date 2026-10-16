import { StorageSerializers, useStorage } from '@vueuse/core'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslations } from '../../types/lang'
import {
  EMPTY_FILTERS,
  parseFilter,
  type MatrixFilterState,
} from './useMatrixFilters'

type FilterQuery = Record<keyof MatrixFilterState, string>

const QUERY_NAMES: FilterQuery = {
  filter: 'filter',
  missingIn: 'missingIn',
  namespace: 'namespace',
  search: 'q',
}
const DEFAULT_FILTER = 'all'
const COLUMNS_STORAGE = 'dms-lang:matrix-columns:'

function filtersOf(
  query: Record<string, string | undefined>,
): MatrixFilterState {
  return {
    filter: parseFilter(query[QUERY_NAMES.filter]),
    missingIn: query[QUERY_NAMES.missingIn] ?? '',
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

function columnsOf(
  stored: Partial<StoredColumns> | null,
): StoredColumns | null {
  if (!Array.isArray(stored?.shown)) return null
  return {
    shown: stored.shown.map(String),
    hidden: Array.isArray(stored.hidden) ? stored.hidden.map(String) : [],
  }
}

function defaultOrder(codes: string[], base: string): string[] {
  return [...codes].sort((a, b) => Number(b === base) - Number(a === base))
}

function restoredOrder(
  codes: string[],
  base: string,
  stored: StoredColumns | null,
): string[] {
  if (!stored) return defaultOrder(codes, base)
  const known = new Set([...stored.shown, ...stored.hidden])
  return [
    ...stored.shown.filter((code) => codes.includes(code)),
    ...codes.filter((code) => !known.has(code)),
  ]
}

function sanitizedFilters(
  filters: MatrixFilterState,
  flat: FlatTranslations,
  namespaces: string[],
): MatrixFilterState | null {
  const { missingIn, namespace } = filters
  const keepsLanguage =
    !missingIn ||
    (flat.locales.includes(missingIn) && missingIn !== flat.defaultLocale)
  const keepsNamespace = !namespace || namespaces.includes(namespace)
  if (keepsLanguage && keepsNamespace) return null
  return {
    ...filters,
    missingIn: keepsLanguage ? missingIn : '',
    namespace: keepsNamespace ? namespace : '',
  }
}

function useFilterQuery() {
  const { route } = useWorkspaceRoute()
  const router = useDmsRouter()
  const filters = ref<MatrixFilterState>(filtersOf(route.query))
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
      const link = linkWithQuery(route.path, {
        ...route.query,
        ...queryOf(next),
      })
      if (link !== linkWithQuery(route.path, route.query))
        void router.replace(link)
    },
    { deep: true },
  )
  return filters
}

function useColumnOrder() {
  const { selectedWorkspace } = useI18nWorkspaces()
  const { flat } = useWorkspaceFlat()
  const stored = useStorage<Partial<StoredColumns> | null>(
    () => `${COLUMNS_STORAGE}${selectedWorkspace.value}`,
    null,
    undefined,
    { serializer: StorageSerializers.object },
  )
  const isMounted = ref(false)
  onMounted(() => {
    isMounted.value = true
  })
  const order = computed(() =>
    restoredOrder(
      flat.value.locales,
      flat.value.defaultLocale,
      isMounted.value ? columnsOf(stored.value) : null,
    ),
  )
  function saveOrder(next: string[]) {
    stored.value = {
      shown: next,
      hidden: flat.value.locales.filter((code) => !next.includes(code)),
    }
  }
  return { order, saveOrder }
}

/**
 * The view of the matrix a user chose: the filters live in the URL (a link
 * or a refresh shows the same keys, Back undoes a filter change made by a
 * link) and the columns shown, in their order, are remembered per workspace
 * in this browser and applied once the page is mounted: a server render
 * shows every language, as the browser's first render does.
 */
export function useMatrixView() {
  const { flat } = useWorkspaceFlat()
  const filters = useFilterQuery()

  return {
    filters,
    ...useColumnOrder(),
    /** Drops filters the workspace cannot have (a language or a namespace it lacks). */
    sanitize(namespaces: string[]) {
      if (!flat.value.locales.length) return
      const next = sanitizedFilters(filters.value, flat.value, namespaces)
      if (next) filters.value = next
    },
    resetFilters() {
      filters.value = { ...EMPTY_FILTERS }
    },
  }
}
