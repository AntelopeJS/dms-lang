import type { EffectScope, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
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

interface FlatStore {
  entries: Ref<Record<string, FlatTranslations>>
  pending: Ref<Record<string, boolean>>
  failed: Ref<Record<string, boolean>>
  touchedAt: Ref<Record<string, number>>
}

interface FlatLoader {
  store: FlatStore
  selectedWorkspace: Ref<string>
  baseLocale: Ref<string>
  fetchWorkspaces: () => Promise<unknown>
  fetchFlat: (workspace: string) => Promise<FlatTranslations>
}

function useFlatStore(): FlatStore {
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
let syncScope: EffectScope | undefined
let syncUsers = 0
let isRejoinClaimed = false

function isFresh(touchedAt: number | undefined, windowMs: number): boolean {
  return touchedAt !== undefined && Date.now() - touchedAt < windowMs
}

function setFlag(
  flags: Ref<Record<string, boolean>>,
  workspace: string,
  value: boolean,
) {
  flags.value = { ...flags.value, [workspace]: value }
}

function touch(store: FlatStore, workspace: string): void {
  store.touchedAt.value = { ...store.touchedAt.value, [workspace]: Date.now() }
}

async function request(loader: FlatLoader, workspace: string): Promise<void> {
  const { store } = loader
  setFlag(store.pending, workspace, true)
  try {
    const response = await loader.fetchFlat(workspace)
    store.entries.value = {
      ...store.entries.value,
      [workspace]: { ...EMPTY_FLAT, ...response },
    }
    setFlag(store.failed, workspace, false)
    touch(store, workspace)
  } catch {
    setFlag(store.failed, workspace, true)
  } finally {
    setFlag(store.pending, workspace, false)
    requests.delete(workspace)
  }
}

function fetchOnce(loader: FlatLoader, workspace: string): Promise<void> {
  const running = requests.get(workspace)
  if (running) return running
  const next = request(loader, workspace)
  requests.set(workspace, next)
  return next
}

function refetch(loader: FlatLoader, withBlocks: boolean): Promise<void> {
  const workspace = loader.selectedWorkspace.value
  if (!workspace) return Promise.resolve()
  const running = reloads.get(workspace)
  if (running) return running
  const next = Promise.all([
    fetchOnce(loader, workspace),
    loader.fetchWorkspaces(),
  ])
    .then(() => {
      if (withBlocks) refreshPageBlocks()
    })
    .finally(() => reloads.delete(workspace))
  reloads.set(workspace, next)
  return next
}

function load(loader: FlatLoader): Promise<void> {
  const workspace = loader.selectedWorkspace.value
  if (!workspace || loader.store.entries.value[workspace])
    return Promise.resolve()
  return fetchOnce(loader, workspace)
}

/**
 * A page that just mounted has fetched its own blocks: only the shared data
 * may be old. A tab coming back shows blocks as old as the data.
 */
function revalidate(loader: FlatLoader, withBlocks: boolean): Promise<void> {
  const workspace = loader.selectedWorkspace.value
  if (!workspace || !loader.store.entries.value[workspace]) return load(loader)
  if (isFresh(loader.store.touchedAt.value[workspace], STALE_AFTER_MS))
    return Promise.resolve()
  return refetch(loader, withBlocks)
}

function useFlatLoader(): FlatLoader {
  const { $authFetch } = useAuthFetch()
  const { fallbackLocale } = useI18n()
  const { selectedWorkspace, fetchWorkspaces } = useI18nWorkspaces()
  const baseLocale = computed(() => resolveDefaultLocale(fallbackLocale.value))
  return {
    store: useFlatStore(),
    selectedWorkspace,
    baseLocale,
    fetchWorkspaces,
    fetchFlat: (workspace) =>
      $authFetch<FlatTranslations>(FLAT_ENDPOINT, {
        query: { workspace, defaultLocale: baseLocale.value },
      }),
  }
}

function onRealtimeChange(
  loader: FlatLoader,
  payload: ChangedPayload | undefined,
): void {
  const workspace = loader.selectedWorkspace.value
  if (payload?.workspace && payload.workspace !== workspace) return
  if (isFresh(loader.store.touchedAt.value[workspace], ECHO_WINDOW_MS)) return
  clearTimeout(realtimeTimer)
  realtimeTimer = setTimeout(
    () => void refetch(loader, true),
    REALTIME_DEBOUNCE_MS,
  )
}

function startSync(loader: FlatLoader): EffectScope {
  const scope = effectScope(true)
  scope.run(() => {
    useRealtimeTopic(LANG_REALTIME_TOPIC, (event) => {
      if ('type' in event)
        onRealtimeChange(loader, event.payload as ChangedPayload)
    })
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') void revalidate(loader, true)
    })
    watch(loader.selectedWorkspace, () => load(loader))
  })
  return scope
}

/** The blocks of one page mount together: one of them joins its topics again. */
function claimRejoin(): boolean {
  if (isRejoinClaimed) return false
  isRejoinClaimed = true
  setTimeout(() => (isRejoinClaimed = false), REJOIN_DELAY_MS)
  return true
}

/**
 * The flat translations of the selected workspace, shared by every component
 * of the page: one request per workspace however many sections read it, and
 * the values a save changed patched in place so every section follows. Reading
 * them has no side effect: each page block mounts `useWorkspaceFlatSync`.
 */
export const useWorkspaceFlat = () => {
  const loader = useFlatLoader()
  const { store, selectedWorkspace } = loader

  function flatOf(workspace: string): FlatTranslations {
    return store.entries.value[workspace] ?? EMPTY_FLAT
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
    touch(store, workspace)
    refreshPageBlocks()
  }

  return {
    flat: computed(() => flatOf(selectedWorkspace.value)),
    flatOf,
    isLoading: computed(
      () => store.pending.value[selectedWorkspace.value] === true,
    ),
    isLoaded: computed(
      () => store.entries.value[selectedWorkspace.value] !== undefined,
    ),
    hasError: computed(
      () => store.failed.value[selectedWorkspace.value] === true,
    ),
    /** Reads the translations and the workspace list again, then every block of the page. */
    reload: () => refetch(loader, true),
    update,
  }
}

/**
 * Keeps the translations of the page fresh, once per page however many of
 * its blocks mount it: loads them, reads them again when the tab comes back
 * into view or the backend says a workspace changed, and follows the selected
 * workspace.
 */
export function useWorkspaceFlatSync(): void {
  const loader = useFlatLoader()
  if (syncUsers === 0) syncScope = startSync(loader)
  syncUsers += 1
  if (claimRejoin()) useRealtimeRejoin()
  onMounted(() => void revalidate(loader, false))
  onBeforeUnmount(() => {
    syncUsers -= 1
    if (syncUsers > 0) return
    syncScope?.stop()
    syncScope = undefined
  })
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
