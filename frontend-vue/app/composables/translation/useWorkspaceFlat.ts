import type { Ref } from 'vue'
import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslations } from '../../types/lang'
import {
  EMPTY_FLAT,
  cloneFlat,
  refreshCounts,
  resolveDefaultLocale,
} from '../../utils/translations'

const FLAT_ENDPOINT = '/api/lang/translations/flat'

/** Realtime topic the backend publishes on after each write. */
export const LANG_REALTIME_TOPIC = 'dms-lang.translations'

/** Data older than this is fetched again when a page shows it. */
const STALE_AFTER_MS = 5000
/** A write echoed back this soon after a local change is already shown. */
const ECHO_WINDOW_MS = 1500
/** Realtime messages arriving together trigger a single reload. */
const REALTIME_DEBOUNCE_MS = 300
/** A page that left its realtime topics this recently and shows again was remounted. */
const REJOIN_WINDOW_MS = 2000
/** Lets the page left behind finish leaving its topics before joining them again. */
const REJOIN_DELAY_MS = 300
const PAGE_REALTIME_KEY = 'dms.realtime.page'

interface ChangedPayload {
  workspace?: string
}

/** What the DMS page provides about its realtime (`providePageRealtime`). */
interface PageRealtime {
  pageId: Ref<string | undefined>
}

interface DroppedPage {
  page: string
  at: number
}

function useFlatStore() {
  return {
    entries: useDmsState<Record<string, FlatTranslations>>(
      'dms-lang-flat',
      () => ({}),
    ),
    pending: useDmsState<Record<string, boolean>>(
      'dms-lang-flat-pending',
      () => ({}),
    ),
    failed: useDmsState<Record<string, boolean>>(
      'dms-lang-flat-failed',
      () => ({}),
    ),
    touchedAt: useDmsState<Record<string, number>>(
      'dms-lang-flat-touched',
      () => ({}),
    ),
  }
}

/** Whether the flat of a workspace is in memory, without loading it. */
export const useFlatPresence = () => {
  const store = useFlatStore()
  return (workspace: string) => store.entries.value[workspace] !== undefined
}

const requests = new Map<string, Promise<void>>()
const reloads = new Map<string, Promise<void>>()
let realtimeTimer: ReturnType<typeof setTimeout> | undefined

function isFresh(touchedAt: number | undefined, windowMs: number): boolean {
  return touchedAt !== undefined && Date.now() - touchedAt < windowMs
}

let droppedPage: DroppedPage | undefined
let isWatchingDrops = false
let isRejoining = false

/**
 * Works around the DMS (`usePageRealtime`): when a page is remounted on the
 * same page id (another language or workspace), the instance it replaces
 * leaves the page's realtime topics on its way out and nothing joins them
 * again. Each time the page id goes away is noted; a page that shows again
 * on that id right after leaves and joins its topics once more.
 */
function useRealtimeRejoin() {
  const realtime = useUserRealtime()
  const pageRealtime = inject<PageRealtime | undefined>(
    PAGE_REALTIME_KEY,
    undefined,
  )
  let timer: ReturnType<typeof setTimeout> | undefined

  function watchDrops(): void {
    if (isWatchingDrops) return
    isWatchingDrops = true
    effectScope(true).run(() =>
      watch(
        realtime.pageId,
        (next, previous) => {
          if (next || !previous || isRejoining) return
          droppedPage = { page: previous, at: Date.now() }
        },
        { flush: 'sync' },
      ),
    )
  }

  async function rejoin(page: string): Promise<void> {
    const dropped = droppedPage
    if (!dropped || dropped.page !== page) return
    if (!isFresh(dropped.at, REJOIN_WINDOW_MS)) return
    // One rejoin per remount, however many sections read the translations;
    // the page id it drops itself is not another remount.
    droppedPage = undefined
    isRejoining = true
    try {
      await realtime.setPage(null)
      await realtime.setPage(page)
    } finally {
      isRejoining = false
    }
  }

  onMounted(() => {
    watchDrops()
    const page = pageRealtime?.pageId.value ?? realtime.pageId.value
    if (page) timer = setTimeout(() => void rejoin(page), REJOIN_DELAY_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))
}

/**
 * The flat translations of the selected workspace, shared by every component
 * of the page: one request per workspace however many sections read it, and
 * the values a save changed patched in place so every section follows. Read
 * again when a page shows stale data, when the tab comes back into view and
 * when the backend says something changed.
 */
export const useWorkspaceFlat = () => {
  const { $authFetch } = useAuthFetch()
  const { fallbackLocale } = useI18n()
  const { selectedWorkspace, fetchWorkspaces } = useI18nWorkspaces()
  const store = useFlatStore()

  const baseLocale = computed(() => resolveDefaultLocale(fallbackLocale.value))
  const flat = computed(
    () => store.entries.value[selectedWorkspace.value] ?? EMPTY_FLAT,
  )
  const isLoading = computed(
    () => store.pending.value[selectedWorkspace.value] === true,
  )
  const hasError = computed(
    () => store.failed.value[selectedWorkspace.value] === true,
  )
  const isLoaded = computed(
    () => store.entries.value[selectedWorkspace.value] !== undefined,
  )

  /** The translations of a workspace read so far, whichever is selected. */
  function flatOf(workspace: string): FlatTranslations {
    return store.entries.value[workspace] ?? EMPTY_FLAT
  }

  function touch(workspace: string): void {
    store.touchedAt.value = {
      ...store.touchedAt.value,
      [workspace]: Date.now(),
    }
  }

  async function request(workspace: string): Promise<void> {
    store.pending.value = { ...store.pending.value, [workspace]: true }
    try {
      const response = await $authFetch<Partial<FlatTranslations>>(
        FLAT_ENDPOINT,
        { query: { workspace, defaultLocale: baseLocale.value } },
      )
      store.entries.value = {
        ...store.entries.value,
        [workspace]: { ...EMPTY_FLAT, ...response },
      }
      store.failed.value = { ...store.failed.value, [workspace]: false }
      touch(workspace)
    } catch {
      store.failed.value = { ...store.failed.value, [workspace]: true }
    } finally {
      store.pending.value = { ...store.pending.value, [workspace]: false }
      requests.delete(workspace)
    }
  }

  function fetchFlat(workspace: string): Promise<void> {
    const running = requests.get(workspace)
    if (running) return running
    const next = request(workspace)
    requests.set(workspace, next)
    return next
  }

  function load(force = false): Promise<void> {
    const workspace = selectedWorkspace.value
    if (!workspace) return Promise.resolve()
    if (!force && store.entries.value[workspace]) return Promise.resolve()
    if (force) return reload()
    return fetchFlat(workspace)
  }

  function refetch(withBlocks: boolean): Promise<void> {
    const workspace = selectedWorkspace.value
    if (!workspace) return Promise.resolve()
    const running = reloads.get(workspace)
    if (running) return running
    const next = Promise.all([fetchFlat(workspace), fetchWorkspaces()])
      .then(() => {
        if (withBlocks) refreshPageBlocks()
      })
      .finally(() => reloads.delete(workspace))
    reloads.set(workspace, next)
    return next
  }

  /** Reads the translations and the workspace list again, then every block of the page. */
  function reload(): Promise<void> {
    return refetch(true)
  }

  // A page that just mounted has fetched its own blocks: only the shared
  // data may be old. A tab coming back shows blocks as old as the data.
  function revalidate(withBlocks = true): Promise<void> {
    const workspace = selectedWorkspace.value
    if (!workspace || !store.entries.value[workspace]) return load()
    if (isFresh(store.touchedAt.value[workspace], STALE_AFTER_MS)) {
      return Promise.resolve()
    }
    return refetch(withBlocks)
  }

  function update(workspace: string, change: (flat: FlatTranslations) => void) {
    const current = store.entries.value[workspace]
    if (!current) return
    const next = cloneFlat(current)
    change(next)
    store.entries.value = {
      ...store.entries.value,
      [workspace]: refreshCounts(next),
    }
    touch(workspace)
    refreshPageBlocks()
  }

  function onRealtimeChange(payload: ChangedPayload | undefined): void {
    const workspace = selectedWorkspace.value
    if (payload?.workspace && payload.workspace !== workspace) return
    if (isFresh(store.touchedAt.value[workspace], ECHO_WINDOW_MS)) return
    clearTimeout(realtimeTimer)
    realtimeTimer = setTimeout(() => void reload(), REALTIME_DEBOUNCE_MS)
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') void revalidate()
  }

  useRealtimeTopic(LANG_REALTIME_TOPIC, (event) => {
    if ('type' in event) onRealtimeChange(event.payload as ChangedPayload)
  })
  useRealtimeRejoin()

  onMounted(() => {
    void revalidate(false)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() =>
    document.removeEventListener('visibilitychange', onVisibilityChange),
  )
  watch(selectedWorkspace, () => load())

  return {
    flat,
    flatOf,
    baseLocale,
    isLoading,
    isLoaded,
    hasError,
    load,
    reload,
    revalidate: () => revalidate(),
    update,
  }
}
