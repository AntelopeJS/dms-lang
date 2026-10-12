import type { EffectScope, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslations } from '../../types/lang'
import { EMPTY_FLAT, cloneFlat, refreshCounts } from '../../utils/translations'

const FLAT_ENDPOINT = '/api/lang/translations/flat'

/** Realtime topic the backend publishes on after each write. */
export const LANG_REALTIME_TOPIC = 'dms-lang.translations'

/** Data older than this is fetched again when a page shows it. */
const STALE_AFTER_MS = 5000
/** A change announced this soon after a local write is read once the local writes settle. */
const ECHO_WINDOW_MS = 1500
/** Realtime messages arriving together trigger a single reload. */
const REALTIME_DEBOUNCE_MS = 300

interface ChangedPayload {
  workspace?: string
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
  const { selectedWorkspace, fetchWorkspaces } = useI18nWorkspaces()
  return {
    store: useFlatStore(),
    selectedWorkspace,
    fetchWorkspaces,
    fetchFlat: (workspace) =>
      $authFetch<FlatTranslations>(FLAT_ENDPOINT, { query: { workspace } }),
  }
}

function echoLeft(loader: FlatLoader): number {
  const touchedAt = loader.store.touchedAt.value[loader.selectedWorkspace.value]
  if (touchedAt === undefined) return 0
  return Math.max(0, touchedAt + ECHO_WINDOW_MS - Date.now())
}

function scheduleReload(loader: FlatLoader): void {
  clearTimeout(realtimeTimer)
  realtimeTimer = setTimeout(
    () => {
      if (echoLeft(loader) > 0) return scheduleReload(loader)
      void refetch(loader, true)
    },
    Math.max(REALTIME_DEBOUNCE_MS, echoLeft(loader)),
  )
}

function onRealtimeChange(
  loader: FlatLoader,
  payload: ChangedPayload | undefined,
): void {
  const workspace = loader.selectedWorkspace.value
  if (payload?.workspace && payload.workspace !== workspace) return
  scheduleReload(loader)
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
  if (import.meta.env.SSR) return
  const loader = useFlatLoader()
  if (syncUsers === 0) syncScope = startSync(loader)
  syncUsers += 1
  onMounted(() => void revalidate(loader, false))
  onBeforeUnmount(() => {
    syncUsers -= 1
    if (syncUsers > 0) return
    syncScope?.stop()
    syncScope = undefined
  })
}
