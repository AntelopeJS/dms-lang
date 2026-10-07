import { useDmsState } from '#dms/frontend-module'
import type {
  WorkspaceLocale,
  WorkspaceStats,
  WorkspaceSummary,
} from '../../types/lang'

interface WorkspacesResponse {
  editable: boolean
  workspaces: WorkspaceSummary[]
}

interface SummaryResponse {
  editable: boolean
  workspaces: WorkspaceStats[]
}

const API_BASE = '/api/lang/translations'
const ENDPOINTS = {
  workspaces: `${API_BASE}/workspaces`,
  summary: `${API_BASE}/summary`,
  export: `${API_BASE}/export`,
  workspace: `${API_BASE}/workspace`,
  workspaceRename: `${API_BASE}/workspace/rename`,
  locale: `${API_BASE}/locale`,
  localeDefault: `${API_BASE}/locale/default`,
  key: `${API_BASE}/key`,
  keyRename: `${API_BASE}/key/rename`,
} as const

export const DEFAULT_WORKSPACE = 'default'
export const MODULES_WORKSPACE = 'modules'

const WORKSPACE_ID_RE = /^[a-z0-9][\w-]{0,63}$/
const RESERVED_WORKSPACE_IDS = new Set([
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  'all',
])

export function normalizeWorkspaceId(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidWorkspaceId(id: string): boolean {
  return WORKSPACE_ID_RE.test(id) && !RESERVED_WORKSPACE_IDS.has(id)
}

function useWorkspacesState() {
  return {
    workspaces: useDmsState<WorkspaceSummary[]>(
      'dms-lang-workspaces',
      () => [],
    ),
    editable: useDmsState<boolean>('dms-lang-workspaces-editable', () => false),
    isLoading: useDmsState<boolean>('dms-lang-workspaces-loading', () => false),
    isLoaded: useDmsState<boolean>('dms-lang-workspaces-loaded', () => false),
    selectedWorkspace: useDmsState<string>(
      'dms-lang-selected-workspace',
      () => DEFAULT_WORKSPACE,
    ),
    requestSeq: useDmsState<number>('dms-lang-workspaces-seq', () => 0),
  }
}

function useWorkspaceWrites() {
  const { $authFetch } = useAuthFetch()
  const send = (url: string, method: string, body: Record<string, unknown>) =>
    $authFetch(url, { method, body })

  return {
    createWorkspace: (id: string, locale: WorkspaceLocale) =>
      send(ENDPOINTS.workspace, 'POST', { id, locale }),
    renameWorkspace: (id: string, newId: string) =>
      send(ENDPOINTS.workspaceRename, 'POST', { id, newId }),
    deleteWorkspace: (id: string) =>
      send(ENDPOINTS.workspace, 'DELETE', { id }),
    addLocale: (workspace: string, locale: WorkspaceLocale) =>
      send(ENDPOINTS.locale, 'POST', { workspace, ...locale }),
    removeLocale: (workspace: string, code: string) =>
      send(ENDPOINTS.locale, 'DELETE', { workspace, code }),
    setDefaultLocale: (workspace: string, code: string) =>
      send(ENDPOINTS.localeDefault, 'POST', { workspace, code }),
    upsertKey: (
      workspace: string,
      path: string,
      values: Record<string, unknown> = {},
      defaultLocale?: string,
    ) => send(ENDPOINTS.key, 'PUT', { workspace, path, values, defaultLocale }),
    renameKey: (workspace: string, path: string, newPath: string) =>
      send(ENDPOINTS.keyRename, 'POST', { workspace, path, newPath }),
    deleteKey: (workspace: string, path: string) =>
      send(ENDPOINTS.key, 'DELETE', { workspace, path }),
  }
}

function useWorkspaceReads() {
  const { $authFetch } = useAuthFetch()
  return {
    fetchSummary: (defaultLocale: string) =>
      $authFetch<SummaryResponse>(ENDPOINTS.summary, {
        query: { defaultLocale },
      }),
    exportWorkspace: (workspace: string) =>
      $authFetch<Record<string, Record<string, unknown>>>(ENDPOINTS.export, {
        query: { workspace },
      }),
  }
}

/**
 * The workspaces of the module, the one selected for every page, and the
 * routes that read and change them.
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

  function ensureSelection(): void {
    const ids = state.workspaces.value.map((workspace) => workspace.id)
    if (ids.includes(state.selectedWorkspace.value)) return
    state.selectedWorkspace.value = ids[0] ?? ''
  }

  async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
    state.requestSeq.value += 1
    const sequence = state.requestSeq.value
    state.isLoading.value = true
    try {
      const response = await $authFetch<WorkspacesResponse>(
        ENDPOINTS.workspaces,
      )
      if (sequence !== state.requestSeq.value) return state.workspaces.value
      state.editable.value = response?.editable ?? false
      state.workspaces.value = response?.workspaces ?? []
      state.isLoaded.value = true
      ensureSelection()
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
    selectedWorkspace: state.selectedWorkspace,
    isLoading: readonly(state.isLoading),
    isLoaded: readonly(state.isLoaded),
    fetchWorkspaces,
    canUseWorkspaceId,
    ...useWorkspaceReads(),
    ...useWorkspaceWrites(),
  }
}
