import type { EffectScope, MaybeRefOrGetter, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { DmsAsyncDataResult } from '#dms/frontend-module'
import type {
  FlatTranslationRow,
  FlatTranslations,
  KeyRowResponse,
} from '../../types/lang'
import { EMPTY_FLAT, withRow } from '../../utils/translations'

/** Realtime topic the backend publishes on after each write. */
export const LANG_REALTIME_TOPIC = 'dms-lang.translations'

/** Data older than this is read again when the tab comes back into view. */
const STALE_AFTER_MS = 5000
/** Realtime messages arriving together trigger a single read. */
const REALTIME_DEBOUNCE_MS = 300
const FLAT_KEY_PREFIX = 'dms-lang-flat:'

/** What the backend says about a write: the workspace, the tab that made it, the keys it changed. */
interface ChangedPayload {
  workspace?: string
  session?: string
  keys?: string[]
}

/** The keys a realtime change named, or `null` to read the workspace whole. */
type ChangedKeys = Set<string> | null

type AuthFetch = ReturnType<typeof useAuthFetch>['$authFetch']

/** What reading a workspace's translations needs. */
interface FlatReadContext {
  workspace: string
  current: FlatTranslations | null
  authFetch: AuthFetch
  signal: AbortSignal
}

type FlatRead = DmsAsyncDataResult<FlatTranslations>

/** How a caller reads the translations of a workspace. */
interface FlatReadOptions {
  /** `false` reads nothing until `execute()` or another caller reads the workspace. */
  immediate?: boolean
}

/** The keys the realtime changes named since the last read, by workspace; read once. */
const changedKeys = new Map<string, ChangedKeys>()
/** Bumped once a burst of realtime changes is heard: the readers read again. */
const heardChanges = ref(0)
/** Bumped when the tab comes back into view after a while: the readers read again. */
const tabReturns = ref(0)
/** When each workspace was last read, for the read on the tab's return. */
const readAt = new Map<string, number>()
let realtimeTimer: ReturnType<typeof setTimeout> | undefined
let syncScope: EffectScope | undefined
let syncUsers = 0

const flatKey = (workspace: string) => `${FLAT_KEY_PREFIX}${workspace}`

function fetchFlat(context: FlatReadContext): Promise<FlatTranslations> {
  return context.authFetch<FlatTranslations>(ENDPOINTS.flat, {
    query: { workspace: context.workspace },
    signal: context.signal,
  })
}

/** The rows the changes named, read one by one into the translations held. */
async function readRows(
  context: FlatReadContext,
  current: FlatTranslations,
  keys: Set<string>,
): Promise<FlatTranslations> {
  let flat = current
  for (const key of keys) {
    const response = await context.authFetch<KeyRowResponse>(ENDPOINTS.row, {
      query: { workspace: context.workspace, key },
      signal: context.signal,
    })
    flat = { ...withRow(flat, key, response.row), ...response.counts }
  }
  return flat
}

/**
 * Reads the translations of a workspace: just the rows a realtime change
 * named when the workspace is held, else (or once a row fails) all of them.
 */
async function readFlat(context: FlatReadContext): Promise<FlatTranslations> {
  const keys = changedKeys.get(context.workspace)
  changedKeys.delete(context.workspace)
  readAt.set(context.workspace, Date.now())
  if (!keys || !context.current) return fetchFlat(context)
  try {
    return await readRows(context, context.current, keys)
  } catch {
    return fetchFlat(context)
  }
}

/**
 * The translations of one workspace, shared by every caller of the
 * workspace: one request however many sections read it. They follow the
 * module's realtime changes on their own (`useLangChanges`), row by row,
 * rather than the page's refreshes.
 */
function useFlatRead(
  workspace: MaybeRefOrGetter<string>,
  options: FlatReadOptions = {},
): FlatRead {
  const key = () => {
    const id = toValue(workspace)
    return id ? flatKey(id) : null
  }
  // The first run starts within the call, before its result is returned.
  let held: FlatRead | undefined
  const read = useApiData<FlatTranslations>(
    key,
    ({ $authFetch, signal }): Promise<FlatTranslations> =>
      readFlat({
        workspace: toValue(workspace),
        current: held && !held.placeholder.value ? held.data.value : null,
        authFetch: $authFetch,
        signal,
      }),
    { immediate: options.immediate, refreshOnPageRefresh: false },
  )
  held = read
  return read
}


function recordChange(workspace: string, payload: ChangedPayload): void {
  const known = changedKeys.get(workspace)
  const isWhole = !payload.keys?.length || known === null
  changedKeys.set(
    workspace,
    isWhole ? null : new Set([...(known ?? []), ...(payload.keys ?? [])]),
  )
  clearTimeout(realtimeTimer)
  realtimeTimer = setTimeout(() => {
    heardChanges.value += 1
  }, REALTIME_DEBOUNCE_MS)
}

/**
 * A change another tab or user made to the workspace on screen: its
 * translations follow, just the rows it names when it names keys. The tab
 * that made the change already has its answer: its echo is skipped. The
 * workspace list and the figures follow with the page, which the same
 * topic refreshes.
 */
function onRealtimeChange(
  selectedWorkspace: string,
  payload: ChangedPayload | undefined,
  ownSession: string | undefined,
): void {
  if (payload?.session && payload.session === ownSession) return
  const workspace = payload?.workspace || selectedWorkspace
  if (workspace === selectedWorkspace) recordChange(workspace, payload ?? {})
}

function startSync(selectedWorkspace: Ref<string>): EffectScope {
  const scope = effectScope(true)
  const { sessionId } = useUserRealtime()
  scope.run(() => {
    useRealtimeTopic(LANG_REALTIME_TOPIC, (event) => {
      if ('type' in event)
        onRealtimeChange(
          selectedWorkspace.value,
          event.payload as ChangedPayload | undefined,
          sessionId.value,
        )
    })
    watch(selectedWorkspace, () => changedKeys.clear())
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (isStale(selectedWorkspace.value)) tabReturns.value += 1
    })
  })
  return scope
}

/** Whether the workspace was read long enough ago to read it again on the tab's return. */
function isStale(workspace: string): boolean {
  const at = readAt.get(workspace)
  return at === undefined || Date.now() - at >= STALE_AFTER_MS
}

/**
 * The flat translations of the selected workspace, shared by every component
 * of the page, and the row a write answers put in place so every section
 * follows. Reading them has no side effect: the matrix and the queue load
 * them with `useWorkspaceFlatSync`.
 */
export const useWorkspaceFlat = () => {
  const workspaces = useI18nWorkspaces()
  const { selectedWorkspace } = workspaces
  const selected = useFlatRead(selectedWorkspace, { immediate: false })
  const modules = useFlatRead(MODULES_WORKSPACE, { immediate: false })

  function readOf(workspace: string): FlatRead | undefined {
    if (workspace === selectedWorkspace.value) return selected
    return workspace === MODULES_WORKSPACE ? modules : undefined
  }

  function flatOf(workspace: string): FlatTranslations {
    return readOf(workspace)?.data.value ?? EMPTY_FLAT
  }

  function setFlat(workspace: string, flat: FlatTranslations): void {
    const read = readOf(workspace)
    if (read?.data.value) read.data.value = flat
  }

  /** Puts a row in place without new figures: a text read from a refusal, a key gone elsewhere. */
  function replaceRow(
    workspace: string,
    key: string,
    row: FlatTranslationRow | undefined,
  ) {
    setFlat(workspace, withRow(flatOf(workspace), key, row))
  }

  /**
   * Puts what a key write answered in place of `key`: its row (a new one
   * before the `before` sibling) and the figures it changed.
   */
  function applyRow(
    workspace: string,
    key: string,
    response: KeyRowResponse,
    before?: string,
  ) {
    const flat = withRow(flatOf(workspace), key, response.row, before)
    setFlat(workspace, { ...flat, ...response.counts })
    workspaces.patchCounts(workspace, response.counts)
  }

  return {
    flat: computed(() => selected.data.value ?? EMPTY_FLAT),
    flatOf,
    isLoading: computed(() => selected.pending.value),
    isLoaded: computed(() => selected.data.value !== null),
    hasError: computed(() => selected.error.value != null),
    /** The translations of the installed modules' workspace, read once and then kept. */
    loadModules: async () => {
      if (modules.data.value === null) await modules.execute()
      return modules.data.value ?? EMPTY_FLAT
    },
    /** Reads the translations of the selected workspace and the workspace list again. */
    reload: async () => {
      await Promise.all([selected.refresh(), workspaces.fetchWorkspaces()])
    },
    /**
     * After a write of this tab whose answer the next step reads (the
     * language just added, the new base): the workspace list, and the
     * translations when the page holds them, which the page's refresh leaves.
     */
    refresh: async () => {
      const flat = selected.data.value === null ? undefined : selected.refresh()
      await Promise.all([flat, workspaces.fetchWorkspaces()])
    },
    applyRow,
    replaceRow,
  }
}

/**
 * Keeps the translations of the page in step with the other tabs and
 * users, once per page however many of its blocks mount it: they follow the
 * module's realtime changes and are read again when the tab comes back into
 * view after a while.
 */
export function useLangChanges(): void {
  if (import.meta.env.SSR) return
  const { selectedWorkspace, fetchWorkspaces } = useI18nWorkspaces()
  const selected = useFlatRead(selectedWorkspace, { immediate: false })
  const readAgain = () => {
    if (selected.data.value !== null) void selected.refresh({ dedupe: 'defer' })
  }
  watch(heardChanges, readAgain)
  watch(tabReturns, () => {
    void fetchWorkspaces()
    readAgain()
  })
  if (syncUsers === 0) syncScope = startSync(selectedWorkspace)
  syncUsers += 1
  onBeforeUnmount(() => {
    syncUsers -= 1
    if (syncUsers > 0) return
    syncScope?.stop()
    syncScope = undefined
  })
}

/**
 * Reads the translations of the selected workspace, for the pages that list
 * them (the matrix, the queue): a server render reads them and hands them to
 * the browser. They follow the selected workspace.
 */
export function useWorkspaceFlatSync(): void {
  const { selectedWorkspace } = useI18nWorkspaces()
  useFlatRead(selectedWorkspace)
  useLangChanges()
}
