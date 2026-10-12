import type { ComputedRef } from 'vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslationRow, FlatTranslations } from '../../types/lang'

export type QueueMode = 'missing' | 'issues' | 'all'

export interface NamespaceProgress {
  namespace: string
  coverage: number
  missing: number
}

/** Whether a row passes a check (fits a mode, holds a draft…). */
type RowCheck = (row: FlatTranslationRow) => boolean

type RowOrder = (left: FlatTranslationRow, right: FlatTranslationRow) => number

type NamespaceCheck = (namespace: string) => boolean

/** The checks a language page sorts its rows with. */
interface RowChecks {
  isMissing: RowCheck
  isOutdated: RowCheck
  hasIssue: RowCheck
  modes: Record<QueueMode, RowCheck>
}

export const QUEUE_MODES: QueueMode[] = ['missing', 'issues', 'all']
const DEFAULT_MODE: QueueMode = 'missing'

function parseMode(value: string | undefined): QueueMode {
  return QUEUE_MODES.find((mode) => mode === value) ?? DEFAULT_MODE
}

/**
 * The text a draft saves: nothing when it is only spaces, else as typed. The
 * spaces around it are kept (and warned about), as in the matrix and the panel.
 */
export function normalizeDraft(draft: string): string {
  return draft.trim() ? draft : ''
}

/**
 * The queue's part of the page URL (`?mode=`, `?namespace=`, `?key=`), read
 * from the route and written back with `replaceQuery`.
 */
function useQueueQuery() {
  const { route } = useWorkspaceRoute()
  const router = useDmsRouter()

  /** Replaces the given parameters of the page URL (an empty one is removed). */
  function replaceQuery(change: PageQuery): Promise<void> {
    if (import.meta.env.SSR) return Promise.resolve()
    return router.replace(
      linkWithQuery(route.path, { ...route.query, ...change }),
      { preserveScroll: true },
    )
  }

  return {
    mode: computed(() => parseMode(route.query.mode)),
    namespace: computed(() => route.query.namespace ?? ''),
    replaceQuery,
  }
}

function rowChecks(locale: ComputedRef<string>): RowChecks {
  const isMissing = (row: FlatTranslationRow) =>
    isRowValueMissing(row, locale.value)
  const isOutdated = (row: FlatTranslationRow) =>
    row.outdated?.includes(locale.value) ?? false
  const hasIssue = (row: FlatTranslationRow) => needsReview(row, locale.value)
  return {
    isMissing,
    isOutdated,
    hasIssue,
    modes: { missing: isMissing, issues: hasIssue, all: () => true },
  }
}

function progressOf(flat: FlatTranslations, locale: string) {
  return namespaceCoverage(flat.rows, [locale])
    .map((entry) => ({
      namespace: entry.namespace,
      coverage: entry.coverage[locale] ?? 0,
      missing: entry.missing[locale] ?? 0,
    }))
    .sort(
      (left, right) =>
        left.coverage - right.coverage ||
        left.namespace.localeCompare(right.namespace),
    )
}

/** The namespaces of the language, least complete first, and the row order it gives. */
function useNamespaceProgress(
  flat: ComputedRef<FlatTranslations>,
  locale: ComputedRef<string>,
) {
  const namespaceProgress = computed<NamespaceProgress[]>(() =>
    progressOf(flat.value, locale.value),
  )
  const namespaceRank = computed(
    () =>
      new Map(
        namespaceProgress.value.map((entry, index) => [entry.namespace, index]),
      ),
  )
  const compareRows: RowOrder = (left, right) => {
    const rankOf = (row: FlatTranslationRow) =>
      namespaceRank.value.get(namespaceOf(row.key)) ?? 0
    return rankOf(left) - rankOf(right) || left.key.localeCompare(right.key)
  }
  const hasNamespace = (name: string) => namespaceRank.value.has(name)
  return { namespaceProgress, hasNamespace, compareRows }
}

/**
 * The mode and the namespace, read from the URL and written back to it. A
 * namespace the language does not have is taken out of the URL.
 */
function useQueueScope(hasNamespace: NamespaceCheck) {
  const query = useQueueQuery()
  const { isLoaded } = useWorkspaceFlat()
  const namespace = computed<string>({
    get: () =>
      hasNamespace(query.namespace.value) ? query.namespace.value : '',
    set: (value) => void query.replaceQuery({ namespace: value }),
  })
  const mode = computed<QueueMode>({
    get: () => query.mode.value,
    set: (value) =>
      void query.replaceQuery({
        mode: value === DEFAULT_MODE ? undefined : value,
      }),
  })
  watch(
    [query.namespace, isLoaded],
    ([raw, loaded]) => {
      if (loaded && raw && !hasNamespace(raw))
        void query.replaceQuery({ namespace: undefined })
    },
    { immediate: true },
  )
  return { mode, namespace, replaceQuery: query.replaceQuery }
}

function queueFacts(
  flat: ComputedRef<FlatTranslations>,
  locale: ComputedRef<string>,
  checks: RowChecks,
  scoped: ComputedRef<FlatTranslationRow[]>,
) {
  const missingOf = (code: string) => flat.value.localeMissing[code] ?? 0
  return {
    isBase: computed(() => locale.value === flat.value.defaultLocale),
    /** The languages to translate besides this one, the least complete first. */
    otherLanguages: computed(() =>
      flat.value.locales
        .filter(
          (code) => code !== flat.value.defaultLocale && code !== locale.value,
        )
        .sort((left, right) => missingOf(right) - missingOf(left)),
    ),
    exists: computed(() => flat.value.locales.includes(locale.value)),
    counts: computed(() => ({
      missing: scoped.value.filter(checks.isMissing).length,
      issues: scoped.value.filter(checks.hasIssue).length,
      all: scoped.value.length,
    })),
    missingTotal: computed(
      () => flat.value.rows.filter(checks.isMissing).length,
    ),
  }
}

/**
 * The keys of a pass: the queue, plus the rows `keep` holds whatever the mode
 * and the namespace, in the order of the queue.
 */
function passOf(
  rows: FlatTranslationRow[],
  queue: FlatTranslationRow[],
  keep: RowCheck,
  compare: RowOrder,
): string[] {
  const inQueue = new Set(queue)
  return rows
    .filter((row) => inQueue.has(row) || keep(row))
    .sort(compare)
    .map((row) => row.key)
}

/**
 * The language a Language page works on (`?locale=`) and the keys its queue
 * walks through, shared by the queue and its side panels. The mode and the
 * namespace live in the URL (`?mode=`, `?namespace=`): a link or a refresh
 * lands on the same queue, and another language starts unscoped.
 */
export const useLanguageQueue = () => {
  const { route } = useWorkspaceRoute()
  const { flat } = useWorkspaceFlat()
  const locale = computed(() => route.query.locale ?? '')
  const checks = rowChecks(locale)
  const order = useNamespaceProgress(flat, locale)
  const scope = useQueueScope(order.hasNamespace)
  const inScope = (row: FlatTranslationRow) =>
    !scope.namespace.value || namespaceOf(row.key) === scope.namespace.value
  const scoped = computed(() => flat.value.rows.filter(inScope))
  const matchesMode = (row: FlatTranslationRow) =>
    checks.modes[scope.mode.value](row)
  const queue = computed(() =>
    scoped.value.filter(matchesMode).sort(order.compareRows),
  )
  return {
    ...queueFacts(flat, locale, checks, scoped),
    ...checks,
    locale,
    baseLocale: computed(() => flat.value.defaultLocale),
    mode: scope.mode,
    namespace: scope.namespace,
    namespaceProgress: order.namespaceProgress,
    queue,
    matchesMode,
    passOf: (keep: RowCheck) =>
      passOf(flat.value.rows, queue.value, keep, order.compareRows),
    /** Writes the key the queue stands on in the page URL. */
    syncKey: (key: string) => scope.replaceQuery({ key }),
  }
}

export type LanguageQueue = ReturnType<typeof useLanguageQueue>
