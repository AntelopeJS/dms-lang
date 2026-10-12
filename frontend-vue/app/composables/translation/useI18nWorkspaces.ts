import { useDmsCookie, useDmsState } from '#dms/frontend-module'
import type {
  FlatCounts,
  FlatTranslations,
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
const ENDPOINTS = {
  workspaces: `${API_BASE}/workspaces`,
  flat: `${API_BASE}/flat`,
  row: `${API_BASE}/row`,
  summary: `${API_BASE}/summary`,
  export: `${API_BASE}/export`,
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
    workspaces: useDmsState<ScopedWorkspace[]>(
      'dms-lang-workspaces',
      () => [],
    ),
    editable: useDmsState<boolean>('dms-lang-workspaces-editable', () => false),
    permissions: useDmsState<WorkspacePermissionIds | null>(
      'dms-lang-workspaces-permissions',
      () => null,
    ),
    publicBaseUrl: useDmsState<string>('dms-lang-public-base-url', () => ''),
    isLoading: useDmsState<boolean>('dms-lang-workspaces-loading', () => false),
    isLoaded: useDmsState<boolean>('dms-lang-workspaces-loaded', () => false),
    selectedWorkspace: useDmsState<string>(
      'dms-lang-selected-workspace',
      () => lastWorkspace.value || DEFAULT_WORKSPACE,
    ),
    requestSeq: useDmsState<number>('dms-lang-workspaces-seq', () => 0),
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

function useWorkspaceReads() {
  const { $authFetch } = useAuthFetch()
  return {
    fetchSummary: () => $authFetch<SummaryResponse>(ENDPOINTS.summary),
    fetchBackup: (workspace: string) =>
      $authFetch<WorkspaceBackup>(ENDPOINTS.backup, { query: { workspace } }),
    fetchFlat: (workspace: string) =>
      $authFetch<FlatTranslations>(ENDPOINTS.flat, { query: { workspace } }),
    fetchRow: (workspace: string, key: string) =>
      $authFetch<KeyRowResponse>(ENDPOINTS.row, { query: { workspace, key } }),
    exportWorkspace: (workspace: string) =>
      $authFetch<Record<string, Record<string, unknown>>>(ENDPOINTS.export, {
        query: { workspace },
      }),
  }
}

/**
 * The workspaces of the module, the one selected for every page, and the
 * routes that read and change them. The selection follows the page URL
 * (`?workspace=`, see useWorkspaceRoute): a workspace the URL names but the
 * list lacks stays selected, so the page can say it does not exist.
 */
export const useI18nWorkspaces = () => {
  const { $authFetch } = useAuthFetch()
  const state = useWorkspacesState()

  function canUseWorkspaceId(id: string): boolean {
    return (
      isValidWorkspaceId(id) &&
      !state.workspaces.value.some((workspace) => workspace.id === id)
    )
  }

  function applyResponse(response: WorkspacesResponse): void {
    state.editable.value = response.editable
    state.workspaces.value = response.workspaces
    state.permissions.value = response.permissions
    state.publicBaseUrl.value = response.publicBaseUrl
    state.isLoaded.value = true
  }

  /** Takes the figures a key write answered into the workspace list (the scope bar). */
  function patchCounts(id: string, counts: FlatCounts): void {
    state.workspaces.value = state.workspaces.value.map((workspace) =>
      workspace.id === id
        ? {
            ...workspace,
            totalKeys: counts.totalKeys,
            baseMissing: counts.baseMissing,
          }
        : workspace,
    )
  }

  /** Remembers the workspace a page without `?workspace=` opens on (a new tab, a menu link). */
  function rememberWorkspace(id: string): void {
    if (state.lastWorkspace.value !== id) state.lastWorkspace.value = id
  }

  async function fetchWorkspaces(): Promise<ScopedWorkspace[]> {
    state.requestSeq.value += 1
    const sequence = state.requestSeq.value
    state.isLoading.value = true
    try {
      const response = await $authFetch<WorkspacesResponse>(
        ENDPOINTS.workspaces,
      )
      if (sequence !== state.requestSeq.value) return state.workspaces.value
      applyResponse(response)
      return state.workspaces.value
    } catch {
      return state.workspaces.value
    } finally {
      if (sequence === state.requestSeq.value) state.isLoading.value = false
    }
  }

  return {
    workspaces: state.workspaces,
    editable: state.editable,
    permissions: readonly(state.permissions),
    publicBaseUrl: readonly(state.publicBaseUrl),
    selectedWorkspace: state.selectedWorkspace,
    isLoading: readonly(state.isLoading),
    isLoaded: readonly(state.isLoaded),
    fetchWorkspaces,
    patchCounts,
    canUseWorkspaceId,
    rememberWorkspace,
    ...useWorkspaceReads(),
    ...useWorkspaceWrites(),
    ...useKeyWrites(),
  }
}
