import { h } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import WorkspaceCreateModal from '../../build/components/WorkspaceCreateModal.vue'
import WorkspaceRenameModal from '../../build/components/WorkspaceRenameModal.vue'

const JSON_INDENT = 2

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
  URL.revokeObjectURL(url)
}

/** Create, rename, back up and delete workspaces. */
export const useWorkspaceActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  const { confirm } = useConfirm()
  const { formatCount } = useLangFormat()
  const {
    selectedWorkspace,
    fetchWorkspaces,
    deleteWorkspace: removeWorkspace,
    exportWorkspace,
  } = useI18nWorkspaces()
  const { reportFailure } = useMutationToast()
  const links = useLangLinks()

  async function createWorkspace(): Promise<string | null> {
    const modal = overlay.create(WorkspaceCreateModal)
    const created = (await modal.open()) as string | null
    if (!created) return null
    selectedWorkspace.value = created
    toast.add({
      title: t('dms_lang.workspace_create.done', { name: created }),
      color: 'success',
      icon: 'i-ph-check-circle',
    })
    return created
  }

  async function renameWorkspace(workspace: string): Promise<string | null> {
    const modal = overlay.create(WorkspaceRenameModal, { props: { workspace } })
    const renamed = (await modal.open()) as string | null
    if (!renamed) return null
    if (selectedWorkspace.value === workspace) selectedWorkspace.value = renamed
    toast.add({
      title: t('dms_lang.workspace_rename.done', { name: renamed }),
      color: 'success',
      icon: 'i-ph-check-circle',
    })
    return renamed
  }

  async function downloadBackup(workspace: string): Promise<void> {
    try {
      const messages = await exportWorkspace(workspace)
      downloadFile(
        `${workspace}.json`,
        JSON.stringify(messages, null, JSON_INDENT),
        'application/json',
      )
    } catch (error) {
      reportFailure(error, { title: t('dms_lang.errors.export_failed') })
    }
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
      impact: [
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
      ],
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
    return deleted
  }

  return {
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    downloadBackup,
    downloadFile,
  }
}
