import { useDmsState } from '#dms-inertia/frontend-module'

export interface WorkspaceLocale {
  code: string
  name?: string
  flag?: string
}

export type WorkspaceKind = 'default' | 'modules' | 'added'

export interface WorkspaceSummary {
  id: string
  kind: WorkspaceKind
  editable: boolean
  defaultLocale: string
  locales: WorkspaceLocale[]
}

interface WorkspacesResponse {
  editable: boolean
  workspaces: WorkspaceSummary[]
}

const API_BASE = '/api/lang/translations'
const WORKSPACES_ENDPOINT = `${API_BASE}/workspaces`
const WORKSPACE_ENDPOINT = `${API_BASE}/workspace`
const WORKSPACE_RENAME_ENDPOINT = `${API_BASE}/workspace/rename`
const LOCALE_ENDPOINT = `${API_BASE}/locale`
const LOCALE_DEFAULT_ENDPOINT = `${API_BASE}/locale/default`
const KEY_ENDPOINT = `${API_BASE}/key`
const KEY_RENAME_ENDPOINT = `${API_BASE}/key/rename`

export const DEFAULT_WORKSPACE = 'default'

const WORKSPACE_ID_RE = /^[a-z0-9][\w-]{0,63}$/

export function normalizeWorkspaceId(raw: string): string {
  return raw.trim().toLowerCase()
}

export const useI18nWorkspaces = () => {
  const { $authFetch } = useAuthFetch()

  const workspaces = useDmsState<WorkspaceSummary[]>(
    'dms-lang-workspaces',
    () => [],
  )
  const editable = useDmsState<boolean>(
    'dms-lang-workspaces-editable',
    () => false,
  )
  const isLoading = useDmsState<boolean>(
    'dms-lang-workspaces-loading',
    () => false,
  )
  const selectedWorkspace = useDmsState<string>(
    'dms-lang-selected-workspace',
    () => DEFAULT_WORKSPACE,
  )
  const requestSeq = useDmsState<number>('dms-lang-workspaces-seq', () => 0)

  function canUseWorkspaceId(id: string): boolean {
    return (
      WORKSPACE_ID_RE.test(id) &&
      !workspaces.value.some((workspace) => workspace.id === id)
    )
  }

  function ensureSelection(): void {
    if (workspaces.value.some((w) => w.id === selectedWorkspace.value)) return
    selectedWorkspace.value = workspaces.value[0]?.id ?? ''
  }

  async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
    requestSeq.value += 1
    const sequence = requestSeq.value
    isLoading.value = true
    try {
      const response = await $authFetch<WorkspacesResponse>(WORKSPACES_ENDPOINT)
      if (sequence !== requestSeq.value) return workspaces.value
      editable.value = response?.editable ?? false
      workspaces.value = response?.workspaces ?? []
      ensureSelection()
      return workspaces.value
    } catch {
      return workspaces.value
    } finally {
      if (sequence === requestSeq.value) isLoading.value = false
    }
  }

  function createWorkspace(id: string, locale: WorkspaceLocale) {
    return $authFetch(WORKSPACE_ENDPOINT, {
      method: 'POST',
      body: { id, locale },
    })
  }

  function renameWorkspace(id: string, newId: string) {
    return $authFetch(WORKSPACE_RENAME_ENDPOINT, {
      method: 'POST',
      body: { id, newId },
    })
  }

  function deleteWorkspace(id: string) {
    return $authFetch(WORKSPACE_ENDPOINT, {
      method: 'DELETE',
      body: { id },
    })
  }

  function addLocale(workspace: string, locale: WorkspaceLocale) {
    return $authFetch(LOCALE_ENDPOINT, {
      method: 'POST',
      body: { workspace, ...locale },
    })
  }

  function removeLocale(workspace: string, code: string) {
    return $authFetch(LOCALE_ENDPOINT, {
      method: 'DELETE',
      body: { workspace, code },
    })
  }

  function setDefaultLocale(workspace: string, code: string) {
    return $authFetch(LOCALE_DEFAULT_ENDPOINT, {
      method: 'POST',
      body: { workspace, code },
    })
  }

  function upsertKey(
    workspace: string,
    path: string,
    values: Record<string, unknown> = {},
    defaultLocale?: string,
  ) {
    return $authFetch(KEY_ENDPOINT, {
      method: 'PUT',
      body: { workspace, path, values, defaultLocale },
    })
  }

  function renameKey(workspace: string, path: string, newPath: string) {
    return $authFetch(KEY_RENAME_ENDPOINT, {
      method: 'POST',
      body: { workspace, path, newPath },
    })
  }

  function deleteKey(workspace: string, path: string) {
    return $authFetch(KEY_ENDPOINT, {
      method: 'DELETE',
      body: { workspace, path },
    })
  }

  return {
    workspaces,
    editable,
    selectedWorkspace,
    isLoading: readonly(isLoading),
    fetchWorkspaces,
    canUseWorkspaceId,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    addLocale,
    removeLocale,
    setDefaultLocale,
    upsertKey,
    renameKey,
    deleteKey,
  }
}
