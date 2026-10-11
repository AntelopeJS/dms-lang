import type { Ref } from 'vue'
import { useDmsRouter, useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow, TranslationValue } from '../../types/lang'

export type QueueMode = 'missing' | 'issues' | 'all'

type KeyStatus = 'done' | 'skipped'

/** What advancing the queue did: moved on, went back to skipped keys, stayed on the last key, or ran out of keys. */
export type QueueStep = 'moved' | 'wrapped' | 'last' | 'finished'

export interface NamespaceProgress {
  namespace: string
  coverage: number
  missing: number
}

export interface QueueEntry {
  row: FlatTranslationRow
  index: number
  isSkipped: boolean
}

interface QueueQuery {
  mode: QueueMode
  namespace: string
}

const QUEUE_MODES: QueueMode[] = ['missing', 'issues', 'all']
const DEFAULT_MODE: QueueMode = 'missing'
const DRAFT_SEPARATOR = '\n'
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

function useQueueUrl() {
  const { route } = useWorkspaceRoute()
  const router = useDmsRouter()
  const readQuery = (): QueueQuery => ({
    mode: parseMode(route.query.mode),
    namespace: route.query.namespace ?? '',
  })
  const state = useDmsState<QueueQuery>('dms-lang-queue', readQuery)

  watch(
    () => [route.query.mode, route.query.namespace],
    () => {
      state.value = readQuery()
    },
    { immediate: true },
  )

  /**
   * Writes the queue state in the page URL, with the key it stands on (the
   * one already there when left out).
   */
  function syncUrl(key = route.query.key ?? ''): Promise<void> {
    const params = new URLSearchParams(route.query)
    const query: Record<string, string> = {
      mode: state.value.mode === DEFAULT_MODE ? '' : state.value.mode,
      namespace: state.value.namespace,
      key,
    }
    for (const [name, value] of Object.entries(query)) {
      if (value) params.set(name, value)
      else params.delete(name)
    }
    return router.replace(`${route.path}?${params.toString()}`, {
      preserveScroll: true,
    })
  }

  return { route, state, syncUrl }
}

/**
 * The language a Language page works on (`?locale=`) and the keys its queue
 * walks through, shared by the queue and its side panels. The mode and the
 * namespace live in the URL (`?mode=`, `?namespace=`): a link or a refresh
 * lands on the same queue, and another language starts unscoped.
 */
export const useLanguageQueue = () => {
  const { route, state, syncUrl } = useQueueUrl()
  const { flat } = useWorkspaceFlat()

  const locale = computed(() => route.query.locale ?? '')
  const baseLocale = computed(() => flat.value.defaultLocale)
  const isBase = computed(() => locale.value === baseLocale.value)
  const exists = computed(() => flat.value.locales.includes(locale.value))

  function isMissing(row: FlatTranslationRow): boolean {
    return isRowValueMissing(row, locale.value)
  }

  /** The base text changed since this translation was written ("To review"). */
  function isOutdated(row: FlatTranslationRow): boolean {
    return row.outdated?.includes(locale.value) ?? false
  }

  // Counted with the issues, as the matrix does: otherwise only All reaches them.
  function hasIssue(row: FlatTranslationRow): boolean {
    return isOutdated(row) || rowHasIssue(row, baseLocale.value, locale.value)
  }

  const MODES: Record<QueueMode, (row: FlatTranslationRow) => boolean> = {
    missing: isMissing,
    issues: hasIssue,
    all: () => true,
  }

  const namespaceProgress = computed<NamespaceProgress[]>(() =>
    namespaceCoverage(flat.value.rows, [locale.value])
      .map((entry) => ({
        namespace: entry.namespace,
        coverage: entry.coverage[locale.value] ?? 0,
        missing: entry.missing[locale.value] ?? 0,
      }))
      .sort(
        (left, right) =>
          left.coverage - right.coverage ||
          left.namespace.localeCompare(right.namespace),
      ),
  )
  const namespaceRank = computed(
    () =>
      new Map(
        namespaceProgress.value.map((entry, index) => [entry.namespace, index]),
      ),
  )

  const mode = computed<QueueMode>({
    get: () => state.value.mode,
    set: (value) => {
      state.value = { ...state.value, mode: value }
      void syncUrl()
    },
  })
  const namespace = computed<string>({
    get: () =>
      namespaceRank.value.has(state.value.namespace)
        ? state.value.namespace
        : '',
    set: (value) => {
      state.value = { ...state.value, namespace: value }
      void syncUrl()
    },
  })

  function compareRows(left: FlatTranslationRow, right: FlatTranslationRow) {
    const rankOf = (row: FlatTranslationRow) =>
      namespaceRank.value.get(namespaceOf(row.key)) ?? 0
    return rankOf(left) - rankOf(right) || left.key.localeCompare(right.key)
  }

  const scoped = computed(() =>
    flat.value.rows.filter(
      (row) => !namespace.value || namespaceOf(row.key) === namespace.value,
    ),
  )
  const queue = computed(() =>
    scoped.value.filter(MODES[mode.value]).sort(compareRows),
  )

  /**
   * The keys of a pass: the queue, plus the rows `keep` holds whatever the
   * mode and the namespace.
   */
  function passOf(keep: (row: FlatTranslationRow) => boolean): string[] {
    const inQueue = new Set(queue.value)
    return flat.value.rows
      .filter((row) => inQueue.has(row) || keep(row))
      .sort(compareRows)
      .map((row) => row.key)
  }
  const counts = computed(() => ({
    missing: scoped.value.filter(isMissing).length,
    issues: scoped.value.filter(hasIssue).length,
    all: scoped.value.length,
  }))
  const missingTotal = computed(() => flat.value.rows.filter(isMissing).length)

  return {
    locale,
    baseLocale,
    isBase,
    exists,
    mode,
    namespace,
    namespaceProgress,
    queue,
    counts,
    missingTotal,
    isMissing,
    isOutdated,
    hasIssue,
    matchesMode: (row: FlatTranslationRow) => MODES[mode.value](row),
    passOf,
    syncUrl,
  }
}

/** A text typed in the queue and not saved yet. */
export interface QueueDraft {
  value: string
  /**
   * The saved value it was started on (`null`: no text), sent as the value
   * expected by the server: a change made elsewhere meanwhile is a conflict.
   */
  start: string | null
}

/** Drafts of one workspace and language, for the links back to them. */
export interface DraftGroup {
  workspace: string
  locale: string
  count: number
}

interface DraftId {
  workspace: string
  locale: string
  key: string
}

function storedValue(value: TranslationValue | undefined): string | null {
  return value === undefined || value === null ? null : String(value)
}

function parseId(id: string): DraftId {
  const [workspace = '', locale = '', ...key] = id.split(DRAFT_SEPARATOR)
  return { workspace, locale, key: key.join(DRAFT_SEPARATOR) }
}

/**
 * The drafts of the queue, per workspace, language and key, kept in the app
 * state: switching language or workspace remounts the page, and the drafts
 * left there are still there on the way back. They only go once the page is
 * left (the leave guard asked first) or once saved or discarded.
 */
function useQueueDrafts(locale: Ref<string>) {
  const { selectedWorkspace } = useI18nWorkspaces()
  const drafts = useDmsState<Record<string, QueueDraft>>(
    'dms-lang-queue-drafts',
    () => ({}),
  )

  const idOf = (key: string) =>
    [selectedWorkspace.value, locale.value, key].join(DRAFT_SEPARATOR)

  function without(id: string): Record<string, QueueDraft> {
    return Object.fromEntries(
      Object.entries(drafts.value).filter(([entry]) => entry !== id),
    )
  }

  function set(key: string, value: string, start: string | null) {
    const others = without(idOf(key))
    drafts.value =
      value === (start ?? '')
        ? others
        : { ...others, [idOf(key)]: { value, start } }
  }

  /** The drafts, grouped per workspace and language. */
  const groups = computed<DraftGroup[]>(() => {
    const found = new Map<string, DraftGroup>()
    for (const id of Object.keys(drafts.value)) {
      const { workspace, locale: code } = parseId(id)
      const name = [workspace, code].join(DRAFT_SEPARATOR)
      const group = found.get(name) ?? { workspace, locale: code, count: 0 }
      found.set(name, { ...group, count: group.count + 1 })
    }
    return [...found.values()]
  })

  return {
    /** Every draft, wherever it was typed: leaving the page loses them all. */
    count: computed(() => Object.keys(drafts.value).length),
    groups,
    /** The groups of the other workspaces and languages than the one shown. */
    elsewhere: computed(() =>
      groups.value.filter(
        (group) =>
          group.workspace !== selectedWorkspace.value ||
          group.locale !== locale.value,
      ),
    ),
    has: (key: string) => idOf(key) in drafts.value,
    read: (key: string): string | undefined => drafts.value[idOf(key)]?.value,
    /** The saved value a draft was started on; `undefined` without a draft. */
    startOf: (key: string): string | null | undefined =>
      drafts.value[idOf(key)]?.start,
    /** Keeps a typed text, started on `saved` unless it already was a draft. */
    write(key: string, value: string, saved: TranslationValue | undefined) {
      const existing = drafts.value[idOf(key)]
      set(key, value, existing ? existing.start : storedValue(saved))
    },
    /** Keeps the text, now started on the value saved elsewhere (overwrite it). */
    rebase(key: string, saved: TranslationValue | undefined) {
      const existing = drafts.value[idOf(key)]
      if (existing) set(key, existing.value, storedValue(saved))
    },
    drop(key: string) {
      drafts.value = without(idOf(key))
    },
    /**
     * Takes out the drafts of the selected workspace whose key or language is
     * gone (deleted elsewhere) and returns them.
     */
    takeOrphans(isAlive: (code: string, key: string) => boolean) {
      const orphans: (DraftId & { value: string })[] = []
      const kept: Record<string, QueueDraft> = {}
      for (const [id, draft] of Object.entries(drafts.value)) {
        const parsed = parseId(id)
        if (
          parsed.workspace === selectedWorkspace.value &&
          !isAlive(parsed.locale, parsed.key)
        ) {
          orphans.push({ ...parsed, value: draft.value })
        } else kept[id] = draft
      }
      if (orphans.length) drafts.value = kept
      return orphans
    },
    clear() {
      drafts.value = {}
    },
  }
}

/**
 * One pass through the queue: the keys it holds are fixed when it starts (a
 * saved key stays in it, so Previous goes back to it), each one done, skipped
 * or still to do. Skipped keys come back once the others are done, and the
 * pass only ends when none is left. Drafts are kept per key until saved.
 */
export const useQueueSession = (upNextSize: number) => {
  const language = useLanguageQueue()
  const { flat, isLoaded } = useWorkspaceFlat()
  const { selectedWorkspace } = useI18nWorkspaces()
  const { route } = useWorkspaceRoute()
  const drafts = useQueueDrafts(language.locale)
  const isStale = (row: FlatTranslationRow): boolean => {
    const start = drafts.startOf(row.key)
    return (
      start !== undefined &&
      start !== storedValue(row.values[language.locale.value])
    )
  }

  const order = ref<string[]>([])
  const status = ref<Record<string, KeyStatus>>({})
  const cursor = ref(0)
  const history = ref<number[]>([])
  const isFinished = ref(false)

  const rowsByKey = computed(
    () => new Map(flat.value.rows.map((row) => [row.key, row])),
  )

  // A key holding a draft stays to do even once it no longer fits the mode
  // (translated elsewhere meanwhile): the draft is shown with the conflict.
  function isPending(key: string | undefined): boolean {
    const row = key === undefined ? undefined : rowsByKey.value.get(key)
    if (!row || status.value[row.key] === 'done') return false
    return language.matchesMode(row) || drafts.has(row.key)
  }

  const pending = computed(() => order.value.filter(isPending))
  const current = computed(() =>
    isFinished.value
      ? undefined
      : rowsByKey.value.get(order.value[cursor.value]),
  )
  const currentStatus = computed(() =>
    current.value ? status.value[current.value.key] : undefined,
  )
  const skippedCount = computed(
    () => pending.value.filter((key) => status.value[key] === 'skipped').length,
  )
  const progress = computed(() =>
    coveragePercent(
      order.value.length - pending.value.length,
      order.value.length,
    ),
  )

  /** Starts a new pass, on `key` when it is in it, with the keys holding a draft. */
  function start(key = '') {
    order.value = language.passOf((row) => drafts.has(row.key))
    status.value = {}
    history.value = []
    cursor.value = Math.max(order.value.indexOf(key), 0)
    isFinished.value = pending.value.length === 0
  }

  function pendingAfter(from: number): number[] {
    const found: number[] = []
    for (let step = 1; step < order.value.length; step++) {
      const index = (from + step) % order.value.length
      if (isPending(order.value[index])) found.push(index)
    }
    return found
  }

  function goTo(index: number) {
    if (!isFinished.value) history.value = [...history.value, cursor.value]
    cursor.value = index
    isFinished.value = false
  }

  function advance(): QueueStep {
    const [next] = pendingAfter(cursor.value)
    if (next === undefined) {
      if (isPending(order.value[cursor.value])) return 'last'
      history.value = [...history.value, cursor.value]
      isFinished.value = true
      return 'finished'
    }
    const wrapped = next < cursor.value
    goTo(next)
    return wrapped ? 'wrapped' : 'moved'
  }

  function mark(key: string, value: KeyStatus) {
    status.value = { ...status.value, [key]: value }
  }

  function skip(): QueueStep {
    const key = current.value?.key
    if (key && isPending(key)) mark(key, 'skipped')
    return advance()
  }

  /** Marks a key saved; moves on when it is the one shown. */
  function complete(key: string): QueueStep | undefined {
    mark(key, 'done')
    return current.value?.key === key ? advance() : undefined
  }

  function previous() {
    const index = history.value.at(-1)
    if (index === undefined) return
    history.value = history.value.slice(0, -1)
    cursor.value = index
    isFinished.value = false
  }

  const upNext = computed<QueueEntry[]>(() =>
    pendingAfter(cursor.value)
      .slice(0, upNextSize)
      .flatMap((index) => {
        const row = rowsByKey.value.get(order.value[index])
        if (!row) return []
        return [{ row, index, isSkipped: status.value[row.key] === 'skipped' }]
      }),
  )

  watch(
    [
      selectedWorkspace,
      language.locale,
      language.mode,
      language.namespace,
      isLoaded,
    ],
    () => {
      if (isLoaded.value) start(route.query.key)
    },
    { immediate: true },
  )
  watch(current, (row) => {
    if (!row && !isFinished.value && order.value.length) advance()
  })

  // Another language or workspace remounts the page on the same path and
  // keeps the drafts; leaving the page (the leave guard asked first) drops
  // them.
  onUnmounted(() => {
    setTimeout(() => {
      if (langPageOf(window.location.pathname) !== 'language') drafts.clear()
    })
  })

  return {
    ...language,
    drafts,
    isStale,
    current,
    currentStatus,
    pending,
    skippedCount,
    progress,
    upNext,
    isFinished,
    canGoBack: computed(() => history.value.length > 0),
    start,
    skip,
    complete,
    previous,
    goTo,
  }
}
