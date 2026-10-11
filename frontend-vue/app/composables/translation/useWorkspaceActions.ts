import { h } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import type { WorkspaceSummary, WorkspaceType } from '../../types/lang'
import {
  BACKUP_FORMAT,
  parseBackup,
  type DetailsChange,
  type WorkspaceBackup,
  type WorkspaceImport,
} from '../../utils/workspaceBackup'
import WorkspaceCreateModal from '../../build/components/WorkspaceCreateModal.vue'
import WorkspaceRenameModal from '../../build/components/WorkspaceRenameModal.vue'

const JSON_INDENT = 2
const REVOKE_DELAY_MS = 1000
const JSON_FILE_TYPES = '.json,application/json'
const WORKSPACE_DESCRIPTION_MAX = 500
const API_BASE = '/api/lang/translations'
const ENDPOINTS = {
  workspace: `${API_BASE}/workspace`,
  backup: `${API_BASE}/backup`,
  import: `${API_BASE}/import`,
} as const

const TYPE_ICONS: Record<WorkspaceType, string> = {
  dms: 'i-ph-squares-four',
  website: 'i-ph-globe',
  mobile: 'i-ph-device-mobile',
  other: 'i-ph-shapes',
}

interface DeleteImpact {
  files: number
  strings: number
}

function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

/** The kinds of app a workspace serves, as a picker offers them. */
export const useWorkspaceTypes = () => {
  const { t } = useI18n()
  const typeItems = computed(() =>
    (Object.keys(TYPE_ICONS) as WorkspaceType[]).map((value) => ({
      value,
      label: t(`dms_lang.workspace_types.${value}`),
      icon: TYPE_ICONS[value],
    })),
  )
  const typeIcon = (type: WorkspaceType) => TYPE_ICONS[type]
  const typeOf = (value: unknown): WorkspaceType | undefined =>
    typeof value === 'string' && value in TYPE_ICONS
      ? (value as WorkspaceType)
      : undefined
  const typeLabel = (type: WorkspaceType) =>
    t(`dms_lang.workspace_types.${type}`)
  return {
    typeItems,
    typeIcon,
    typeLabel,
    typeOf,
    descriptionMax: WORKSPACE_DESCRIPTION_MAX,
  }
}

/** The routes behind a workspace's details, its backup and its import. */
export const useWorkspaceApi = () => {
  const { $authFetch } = useAuthFetch()
  return {
    updateWorkspace: (id: string, change: DetailsChange) =>
      $authFetch<WorkspaceSummary>(ENDPOINTS.workspace, {
        method: 'PATCH',
        body: { id, ...change },
      }),
    fetchBackup: (workspace: string) =>
      $authFetch<WorkspaceBackup>(ENDPOINTS.backup, { query: { workspace } }),
    importWorkspace: (id: string, backup: WorkspaceImport) =>
      $authFetch<WorkspaceSummary>(ENDPOINTS.import, {
        method: 'POST',
        body: { ...backup, format: BACKUP_FORMAT, id },
      }),
  }
}

/** Create, import, rename, back up and delete workspaces. */
export const useWorkspaceActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  const { confirm } = useConfirm()
  const { formatCount } = useLangFormat()
  const { fetchWorkspaces, deleteWorkspace: removeWorkspace } =
    useI18nWorkspaces()
  const { selectWorkspace } = useWorkspaceRoute()
  const api = useWorkspaceApi()
  const { tryMutate, reportFailure } = useMutationToast()
  const links = useLangLinks()

  function succeed(title: string): void {
    toast.add({ title, color: 'success', icon: 'i-ph-check-circle' })
  }

  async function openCreate(backup?: WorkspaceBackup): Promise<string | null> {
    const modal = overlay.create(WorkspaceCreateModal, { props: { backup } })
    const created = (await modal.open()) as string | null
    if (!created) return null
    await fetchWorkspaces()
    succeed(
      t(`dms_lang.workspace_${backup ? 'import' : 'create'}.done`, {
        name: created,
      }),
    )
    await selectWorkspace(created, { page: 'workspace' })
    return created
  }

  const createWorkspace = () => openCreate()

  async function importWorkspace(): Promise<string | null> {
    const file = await pickFile(JSON_FILE_TYPES)
    if (!file) return null
    const read = parseBackup(await file.text(), file.name)
    if (read.backup) return openCreate(read.backup)
    toast.add({
      title: t(`dms_lang.workspace_import.${read.problem}_title`, {
        file: file.name,
      }),
      description: t(`dms_lang.workspace_import.${read.problem}_help`),
      color: 'error',
      icon: 'i-ph-warning-circle',
    })
    return null
  }

  async function renameWorkspace(workspace: string): Promise<string | null> {
    const modal = overlay.create(WorkspaceRenameModal, { props: { workspace } })
    const renamed = (await modal.open()) as string | null
    if (!renamed) return null
    await fetchWorkspaces()
    succeed(t('dms_lang.workspace_rename.done', { name: renamed }))
    await selectWorkspace(renamed, { replace: true })
    return renamed
  }

  async function updateDetails(id: string, change: DetailsChange) {
    const ok = await tryMutate(() => api.updateWorkspace(id, change), {
      title: t('dms_lang.workspace_details.save_failed'),
    })
    if (!ok) return false
    await fetchWorkspaces()
    refreshPageBlocks()
    return true
  }

  async function downloadBackup(workspace: string): Promise<void> {
    try {
      const backup = await api.fetchBackup(workspace)
      downloadFile(
        `${workspace}.json`,
        JSON.stringify(backup, null, JSON_INDENT),
        'application/json',
      )
    } catch (error) {
      reportFailure(error, { title: t('dms_lang.errors.export_failed') })
    }
  }

  function deleteImpact(workspace: string, impact: DeleteImpact) {
    return [
      {
        icon: 'i-ph-files',
        label: t('dms_lang.workspace_delete.files'),
        count: formatCount(impact.files),
      },
      {
        icon: 'i-ph-text-aa',
        label: t('dms_lang.workspace_delete.strings'),
        count: formatCount(impact.strings),
      },
      {
        icon: 'i-ph-plugs',
        label: t('dms_lang.workspace_delete.url', {
          url: links.publicLocaleUrl(workspace),
        }),
      },
    ]
  }

  async function deleteWorkspace(
    workspace: string,
    impact: DeleteImpact,
  ): Promise<boolean> {
    const deleted = await confirm({
      title: t('dms_lang.workspace_delete.title', { name: workspace }),
      description: t('dms_lang.workspace_delete.description'),
      color: 'error',
      confirmLabel: t('dms_lang.workspace_delete.submit'),
      confirmText: workspace,
      impact: deleteImpact(workspace, impact),
      body: () =>
        h(UButton, {
          icon: 'i-ph-download-simple',
          color: 'neutral',
          variant: 'outline',
          size: 'sm',
          class: 'self-start',
          label: t('dms_lang.workspace_delete.backup'),
          onClick: () => downloadBackup(workspace),
        }),
      onConfirm: async () => {
        await removeWorkspace(workspace)
        await fetchWorkspaces()
      },
    })
    if (!deleted) return false
    succeed(t('dms_lang.workspace_delete.done', { name: workspace }))
    await selectWorkspace(DEFAULT_WORKSPACE, {
      page: 'workspaces',
      replace: true,
    })
    return true
  }

  return {
    createWorkspace,
    importWorkspace,
    renameWorkspace,
    updateDetails,
    deleteWorkspace,
    downloadBackup,
    downloadFile,
  }
}
