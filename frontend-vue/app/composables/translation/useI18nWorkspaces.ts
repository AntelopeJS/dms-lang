import { useDmsCookie, useDmsState } from '#dms/frontend-module'
import type {
  FlatCounts,
  KeyRowResponse,
  ScopedWorkspace,
  WorkspaceDetails,
  WorkspaceLocale,
  WorkspacePermissionIds,
  WorkspaceStats,
  WorkspaceSummary,
} from '../../types/lang'
import {
  BACKUP_FORMAT,
  type DetailsChange,
  type WorkspaceBackup,
  type WorkspaceImport,
} from '../../utils/workspaceBackup'

interface WorkspacesResponse {
  editable: boolean
  workspaces: ScopedWorkspace[]
  permissions: WorkspacePermissionIds
  publicBaseUrl: string
}

interface SummaryResponse {
  editable: boolean
  workspaces: WorkspaceStats[]
}

type KeyValues = Record<string, unknown>

/** The routes of the module's API. */
export const LANG_API = '/api/lang/translations'
const API_BASE = LANG_API
export const ENDPOINTS = {
  workspaces: `${API_BASE}/workspaces`,
  flat: `${API_BASE}/flat`,
  row: `${API_BASE}/row`,
  summary: `${API_BASE}/summary`,
  workspace: `${API_BASE}/workspace`,
  workspaceRename: `${API_BASE}/workspace/rename`,
  backup: `${API_BASE}/backup`,
  import: `${API_BASE}/import`,
  locale: `${API_BASE}/locale`,
  languages: `${API_BASE}/languages`,
  key: `${API_BASE}/key`,
  keyRename: `${API_BASE}/key/rename`,
  keyOverride: `${API_BASE}/key/override`,
  keyReviewed: `${API_BASE}/key/reviewed`,
} as const

export const DEFAULT_WORKSPACE = 'default'
export const MODULES_WORKSPACE = 'modules'

/** The route of one language of a workspace: removing it, making it the base, the dialogs that ask first. */
export function languageUrl(workspace: string, code: string): string {
  return `${ENDPOINTS.languages}/${encodeURIComponent(workspace)}/${encodeURIComponent(code)}`
}

const LAST_WORKSPACE_COOKIE = 'dms-lang-workspace'
const LAST_WORKSPACE_MAX_AGE = 60 * 60 * 24 * 365

const WORKSPACE_ID_RE = /^[a-z0-9][\w-]{0,63}$/
const RESERVED_WORKSPACE_IDS = new Set([DEFAULT_WORKSPACE, MODULES_WORKSPACE])

export function normalizeWorkspaceId(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidWorkspaceId(id: string): boolean {
  return WORKSPACE_ID_RE.test(id) && !RESERVED_WORKSPACE_IDS.has(id)
}

function useLastWorkspace() {
  return useDmsCookie<string>(LAST_WORKSPACE_COOKIE, {
    default: () => DEFAULT_WORKSPACE,
    maxAge: LAST_WORKSPACE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  })
}

function useWorkspacesState() {
  const lastWorkspace = useLastWorkspace()
  return {
    lastWorkspace,
    selectedWorkspace: useDmsState<string>(
      'dms-lang-selected-workspace',
      () => lastWorkspace.value || DEFAULT_WORKSPACE,
    ),
  }
}

function useKeyWrites() {
  const { $authFetch } = useAuthFetch()
  const send = (url: string, method: string, body: Record<string, unknown>) =>
    $authFetch<KeyRowResponse>(url, { method, body })

  return {
    /** `before`: the path of the sibling the key goes right before (an undone deletion). */
    createKey: (
      workspace: string,
      path: string,
      values: KeyValues,
      before?: string,
    ) => send(ENDPOINTS.key, 'POST', { workspace, path, values, before }),
    /** `expected`: the texts the change was made on, a 409 when they changed since. */
    updateKey: (
      workspace: string,
      path: string,
      values: KeyValues = {},
      expected?: KeyValues,
    ) => send(ENDPOINTS.key, 'PUT', { workspace, path, values, expected }),
    /** Keeps translations as they are although the base text changed. */
    markReviewed: (workspace: string, path: string, locales: string[]) =>
      send(ENDPOINTS.keyReviewed, 'POST', { workspace, path, locales }),
    revertOverride: (workspace: string, path: string, locales?: string[]) =>
      send(ENDPOINTS.keyOverride, 'DELETE', { workspace, path, locales }),
    renameKey: (workspace: string, path: string, newPath: string) =>
      send(ENDPOINTS.keyRename, 'POST', { workspace, path, newPath }),
    deleteKey: (workspace: string, path: string) =>
      send(ENDPOINTS.key, 'DELETE', { workspace, path }),
  }
}

function useWorkspaceWrites() {
  const { $authFetch } = useAuthFetch()
  const send = (url: string, method: string, body: Record<string, unknown>) =>
    $authFetch(url, { method, body })

  return {
    createWorkspace: (
      id: string,
      locale: WorkspaceLocale,
      details: WorkspaceDetails = {},
    ) => send(ENDPOINTS.workspace, 'POST', { id, locale, ...details }),
    renameWorkspace: (id: string, newId: string) =>
      send(ENDPOINTS.workspaceRename, 'POST', { id, newId }),
    deleteWorkspace: (id: string) =>
      send(ENDPOINTS.workspace, 'DELETE', { id }),
    updateWorkspace: (id: string, change: DetailsChange) =>
      $authFetch<WorkspaceSummary>(ENDPOINTS.workspace, {
        method: 'PATCH',
        body: { id, ...change },
      }),
    importWorkspace: (id: string, backup: WorkspaceImport) =>
      $authFetch<WorkspaceSummary>(ENDPOINTS.import, {
        method: 'POST',
        body: { ...backup, format: BACKUP_FORMAT, id },
      }),
    addLocale: (workspace: string, locale: WorkspaceLocale) =>
      send(ENDPOINTS.locale, 'POST', { workspace, ...locale }),
    removeLocale: (workspace: string, code: string) =>
      $authFetch(languageUrl(workspace, code), { method: 'DELETE' }),
    setDefaultLocale: (workspace: string, code: string) =>
      $authFetch(`${languageUrl(workspace, code)}/base`, { method: 'POST' }),
  }
}

/** The backup file a download saves: a file the user keeps, not data a page shows. */
function useWorkspaceDownloads() {
  const { $authFetch } = useAuthFetch()
  return {
    fetchBackup: (workspace: string) =>
      $authFetch<WorkspaceBackup>(ENDPOINTS.backup, { query: { workspace } }),
  }
}

/** The workspaces with their figures, for the workspace list page. */
export const useWorkspaceSummary = () =>
  useApiData<SummaryResponse>(ENDPOINTS.summary)

/**
 * The workspaces of the module, the one selected for every page, and the
 * routes that read and change them. The list is read with the page, once for
 * every block showing it: a server render hands it to the browser. The
 * selection follows the page URL (`?workspace=`, see useWorkspaceRoute): a
 * workspace the URL names but the list lacks stays selected, so the page can
 * say it does not exist.
 */
export const useI18nWorkspaces = () => {
  const state = useWorkspacesState()
  const list = useApiData<WorkspacesResponse>(ENDPOINTS.workspaces)
  const workspaces = computed(() => list.data.value?.workspaces ?? [])

  function canUseWorkspaceId(id: string): boolean {
    return (
      isValidWorkspaceId(id) &&
      !workspaces.value.some((workspace) => workspace.id === id)
    )
  }

  function mapWorkspace(
    id: string,
    change: (workspace: ScopedWorkspace) => ScopedWorkspace,
  ): void {
    const current = list.data.value
    if (!current) return
    list.data.value = {
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id ? change(workspace) : workspace,
      ),
    }
  }

  /** Takes the figures a key write answered into the workspace list (the scope bar). */
  function patchCounts(id: string, counts: FlatCounts): void {
    mapWorkspace(id, (workspace) => ({
      ...workspace,
      totalKeys: counts.totalKeys,
      baseMissing: counts.baseMissing,
    }))
  }

  /** Takes the workspace a details write answered into the list, its figures kept. */
  function patchSummary(summary: WorkspaceSummary): void {
    mapWorkspace(summary.id, (workspace) => ({
      ...summary,
      totalKeys: workspace.totalKeys,
      baseMissing: workspace.baseMissing,
      translatedStrings: workspace.translatedStrings,
    }))
  }

  /** Remembers the workspace a page without `?workspace=` opens on (a new tab, a menu link). */
  function rememberWorkspace(id: string): void {
    if (state.lastWorkspace.value !== id) state.lastWorkspace.value = id
  }

  /** Reads the list again, after a write or a change heard from elsewhere. */
  async function fetchWorkspaces(): Promise<ScopedWorkspace[]> {
    await list.refresh()
    return workspaces.value
  }

  return {
    workspaces,
    editable: computed(() => list.data.value?.editable ?? false),
    permissions: computed(() => list.data.value?.permissions ?? null),
    publicBaseUrl: computed(() => list.data.value?.publicBaseUrl ?? ''),
    selectedWorkspace: state.selectedWorkspace,
    isLoading: computed(() => list.pending.value),
    /** The list was read once: the page can tell a workspace it lacks. */
    isLoaded: computed(() => list.data.value !== null),
    /** Resolves once the list was read: what a server render waits for. */
    whenLoaded: async (): Promise<void> => {
      await list
    },
    fetchWorkspaces,
    patchCounts,
    patchSummary,
    canUseWorkspaceId,
    rememberWorkspace,
    ...useWorkspaceDownloads(),
    ...useWorkspaceWrites(),
    ...useKeyWrites(),
  }
}
