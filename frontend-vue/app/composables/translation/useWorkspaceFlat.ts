import type { EffectScope, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useDmsState } from '#dms/frontend-module'
import type {
  FlatCounts,
  FlatTranslationRow,
  FlatTranslations,
  KeyRowResponse,
} from '../../types/lang'
import { EMPTY_FLAT, withRow } from '../../utils/translations'

/** Realtime topic the backend publishes on after each write. */
export const LANG_REALTIME_TOPIC = 'dms-lang.translations'

/** Data older than this is fetched again when the tab comes back into view. */
const STALE_AFTER_MS = 5000
/** Realtime messages arriving together trigger a single reload. */
const REALTIME_DEBOUNCE_MS = 300
/** Longer than a page change: no page of the module listened meanwhile, its data may have moved. */
const UNTRACKED_GRACE_MS = 1000

/** What the backend says about a write: the workspace, the tab that made it, the keys it changed. */
interface ChangedPayload {
  workspace?: string
  session?: string
  keys?: string[]
}

/** The changes heard since the last reload, by workspace: the keys, or `null` to read it all again. */
type PendingChanges = Map<string, Set<string> | null>

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
  patchCounts: (workspace: string, counts: FlatCounts) => void
  fetchFlat: (workspace: string) => Promise<FlatTranslations>
  fetchRow: (workspace: string, key: string) => Promise<KeyRowResponse>
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

const requests = new Map<string, Promise<void>>()
const changes: PendingChanges = new Map()
let realtimeTimer: ReturnType<typeof setTimeout> | undefined
let syncScope: EffectScope | undefined
let syncUsers = 0
let stoppedAt: number | undefined

function setFlag(
  flags: Ref<Record<string, boolean>>,
  workspace: string,
  value: boolean,
) {
  flags.value = { ...flags.value, [workspace]: value }
}

function setEntry(
  store: FlatStore,
  workspace: string,
  flat: FlatTranslations,
): void {
  store.entries.value = { ...store.entries.value, [workspace]: flat }
  store.touchedAt.value = { ...store.touchedAt.value, [workspace]: Date.now() }
}

async function request(loader: FlatLoader, workspace: string): Promise<void> {
  const { store } = loader
  setFlag(store.pending, workspace, true)
  try {
    setEntry(store, workspace, await loader.fetchFlat(workspace))
    setFlag(store.failed, workspace, false)
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

/** Puts a row as the server now has it (none once the key is gone), with the figures it changed. */
function applyRow(
  loader: FlatLoader,
  workspace: string,
  key: string,
  response: KeyRowResponse,
  before?: string,
): void {
  const current = loader.store.entries.value[workspace]
  if (!current) return
  const flat = withRow(current, key, response.row, before)
  setEntry(loader.store, workspace, { ...flat, ...response.counts })
  loader.patchCounts(workspace, response.counts)
}

async function readRows(
  loader: FlatLoader,
  workspace: string,
  keys: Set<string>,
): Promise<void> {
  try {
    for (const key of keys)
      applyRow(loader, workspace, key, await loader.fetchRow(workspace, key))
  } catch {
    await fetchOnce(loader, workspace)
  }
}

function readChanges(loader: FlatLoader): void {
  const heard = [...changes]
  changes.clear()
  void loader.fetchWorkspaces()
  for (const [workspace, keys] of heard) {
    if (!loader.store.entries.value[workspace]) continue
    void (keys ? readRows(loader, workspace, keys) : fetchOnce(loader, workspace))
  }
}

function recordChange(loader: FlatLoader, payload: ChangedPayload): void {
  const workspace = payload.workspace || loader.selectedWorkspace.value
  const known = changes.get(workspace)
  const isWhole = !payload.keys?.length || known === null
  changes.set(
    workspace,
    isWhole ? null : new Set([...(known ?? []), ...(payload.keys ?? [])]),
  )
  clearTimeout(realtimeTimer)
  realtimeTimer = setTimeout(() => readChanges(loader), REALTIME_DEBOUNCE_MS)
}

/**
 * A change another tab or user made: the workspace list is read again, and
 * the translations in memory follow, just the rows it names when it names
 * keys. The tab that made the change already has its answer: its echo is
 * skipped.
 */
function onRealtimeChange(
  loader: FlatLoader,
  payload: ChangedPayload | undefined,
  ownSession: string | undefined,
): void {
  if (payload?.session && payload.session === ownSession) return
  recordChange(loader, payload ?? {})
}

/** Reads the selected workspace again when the tab comes back after a while. */
function revalidate(loader: FlatLoader): void {
  const workspace = loader.selectedWorkspace.value
  const touchedAt = loader.store.touchedAt.value[workspace]
  if (touchedAt !== undefined && Date.now() - touchedAt < STALE_AFTER_MS)
    return
  void loader.fetchWorkspaces()
  if (loader.store.entries.value[workspace]) void fetchOnce(loader, workspace)
}

/** Forgets the translations kept while no page of the module was listening to its changes. */
function forgetUntracked(store: FlatStore): void {
  if (stoppedAt === undefined || Date.now() - stoppedAt < UNTRACKED_GRACE_MS)
    return
  store.entries.value = {}
}

function startSync(loader: FlatLoader): EffectScope {
  forgetUntracked(loader.store)
  const scope = effectScope(true)
  const { sessionId } = useUserRealtime()
  scope.run(() => {
    useRealtimeTopic(LANG_REALTIME_TOPIC, (event) => {
      if ('type' in event)
        onRealtimeChange(
          loader,
          event.payload as ChangedPayload | undefined,
          sessionId.value,
        )
    })
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') revalidate(loader)
    })
  })
  return scope
}

function useFlatLoader(): FlatLoader {
  const workspaces = useI18nWorkspaces()
  return {
    store: useFlatStore(),
    selectedWorkspace: workspaces.selectedWorkspace,
    fetchWorkspaces: workspaces.fetchWorkspaces,
    patchCounts: workspaces.patchCounts,
    fetchFlat: workspaces.fetchFlat,
    fetchRow: workspaces.fetchRow,
  }
}

/**
 * The flat translations of the selected workspace, shared by every component
 * of the page: one request per workspace however many sections read it, and
 * the row a write answers put in place so every section follows. Reading
 * them has no side effect: the matrix and the queue load them with
 * `useWorkspaceFlatSync`.
 */
export const useWorkspaceFlat = () => {
  const loader = useFlatLoader()
  const { store, selectedWorkspace } = loader

  function flatOf(workspace: string): FlatTranslations {
    return store.entries.value[workspace] ?? EMPTY_FLAT
  }

  /** Puts a row in place without new figures: a text read from a refusal, a key gone elsewhere. */
  function replaceRow(
    workspace: string,
    key: string,
    row: FlatTranslationRow | undefined,
  ) {
    const current = store.entries.value[workspace]
    if (current) setEntry(store, workspace, withRow(current, key, row))
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
    /** The translations of a workspace, read once and then kept in step. */
    load: async (workspace: string) => {
      if (!store.entries.value[workspace]) await fetchOnce(loader, workspace)
      return flatOf(workspace)
    },
    /** Reads the translations of the selected workspace and the workspace list again. */
    reload: async () => {
      const workspace = selectedWorkspace.value
      await Promise.all([fetchOnce(loader, workspace), loader.fetchWorkspaces()])
    },
    /** After a write of this tab: the workspace list, and the translations when the page holds them. */
    refresh: async () => {
      const workspace = selectedWorkspace.value
      const flat = store.entries.value[workspace]
        ? fetchOnce(loader, workspace)
        : undefined
      await Promise.all([flat, loader.fetchWorkspaces()])
    },
    /**
     * Puts what a key write answered in place of `key`: its row (a new one
     * before the `before` sibling) and the figures it changed.
     */
    applyRow: (
      workspace: string,
      key: string,
      response: KeyRowResponse,
      before?: string,
    ) => applyRow(loader, workspace, key, response, before),
    replaceRow,
  }
}

/**
 * Keeps the workspace data of the page in step with the other tabs and
 * users, once per page however many of its blocks mount it: the workspace
 * list and the translations in memory follow the module's realtime changes
 * and are read again when the tab comes back into view.
 */
export function useLangChanges(): void {
  if (import.meta.env.SSR) return
  const loader = useFlatLoader()
  if (syncUsers === 0) syncScope = startSync(loader)
  syncUsers += 1
  onBeforeUnmount(() => {
    syncUsers -= 1
    if (syncUsers > 0) return
    syncScope?.stop()
    syncScope = undefined
    stoppedAt = Date.now()
  })
}

/**
 * Loads the translations of the selected workspace, for the pages that list
 * them (the matrix, the queue), and follows the selected workspace.
 */
export function useWorkspaceFlatSync(): void {
  if (import.meta.env.SSR) return
  const loader = useFlatLoader()
  const load = () => {
    const workspace = loader.selectedWorkspace.value
    if (workspace && !loader.store.entries.value[workspace])
      void fetchOnce(loader, workspace)
  }
  useLangChanges()
  onMounted(load)
  watch(loader.selectedWorkspace, load)
}
