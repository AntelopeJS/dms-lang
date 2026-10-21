import { h } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import type { WorkspaceKind, WorkspaceType } from '../../types/lang'
import {
  parseBackup,
  type DetailsChange,
  type WorkspaceBackup,
} from '../../utils/workspaceBackup'
import WorkspaceCreateModal from '../../build/components/WorkspaceCreateModal.vue'
import WorkspaceRenameModal from '../../build/components/WorkspaceRenameModal.vue'

const JSON_FILE_TYPES = '.json,application/json'
const WORKSPACE_DESCRIPTION_MAX = 500

const TYPE_ICONS: Record<WorkspaceType, string> = {
  dms: 'i-ph-squares-four',
  website: 'i-ph-globe',
  mobile: 'i-ph-device-mobile',
  other: 'i-ph-shapes',
}

const KIND_ICONS: Record<WorkspaceKind, string> = {
  default: 'i-ph-file-code',
  added: 'i-ph-stack',
  modules: 'i-ph-puzzle-piece',
}

function isWorkspaceType(value: unknown): value is WorkspaceType {
  return typeof value === 'string' && Object.hasOwn(TYPE_ICONS, value)
}

interface DeleteImpact {
  files: number
  strings: number
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

/** The kinds of app a workspace serves, as a picker offers them, and the icon of each kind of workspace. */
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
    isWorkspaceType(value) ? value : undefined
  const typeLabel = (type: WorkspaceType) =>
    t(`dms_lang.workspace_types.${type}`)
  return {
    typeItems,
    typeIcon,
    typeLabel,
    typeOf,
    kindIcon: (kind: WorkspaceKind) => KIND_ICONS[kind],
    descriptionMax: WORKSPACE_DESCRIPTION_MAX,
  }
}

/** What the workspace actions share: the workspaces, the routes and the DMS helpers. */
interface WorkspaceActionsContext {
  t: ReturnType<typeof useI18n>['t']
  toast: ReturnType<typeof useToast>
  overlay: ReturnType<typeof useOverlay>
  confirm: ReturnType<typeof useConfirm>['confirm']
  formatCount: ReturnType<typeof useLangFormat>['formatCount']
  workspaces: ReturnType<typeof useI18nWorkspaces>
  selectWorkspace: ReturnType<typeof useWorkspaceRoute>['selectWorkspace']
  failures: ReturnType<typeof useMutationToast>
  links: ReturnType<typeof useLangLinks>
}

function succeed(context: WorkspaceActionsContext, title: string): void {
  context.toast.add({ title, color: 'success', icon: 'i-ph-check-circle' })
}

async function openCreate(
  context: WorkspaceActionsContext,
  backup?: WorkspaceBackup,
): Promise<string | null> {
  const modal = context.overlay.create(WorkspaceCreateModal, {
    props: { backup },
  })
  const created = (await modal.open()) as string | null
  if (!created) return null
  await context.workspaces.fetchWorkspaces()
  const texts = backup ? 'workspace_import' : 'workspace_create'
  succeed(context, context.t(`dms_lang.${texts}.done`, { name: created }))
  await context.selectWorkspace(created, { page: 'workspace' })
  return created
}

async function importWorkspace(
  context: WorkspaceActionsContext,
): Promise<string | null> {
  const { t } = context
  const file = await pickFile(JSON_FILE_TYPES)
  if (!file) return null
  const read = parseBackup(await file.text(), file.name)
  if (read.backup) return openCreate(context, read.backup)
  context.toast.add({
    title: t(`dms_lang.workspace_import.${read.problem}_title`, {
      file: file.name,
    }),
    description: t(`dms_lang.workspace_import.${read.problem}_help`),
    color: 'error',
    icon: 'i-ph-warning-circle',
  })
  return null
}

async function renameWorkspace(
  context: WorkspaceActionsContext,
  workspace: string,
): Promise<string | null> {
  const modal = context.overlay.create(WorkspaceRenameModal, {
    props: { workspace },
  })
  const renamed = (await modal.open()) as string | null
  if (!renamed) return null
  await context.workspaces.fetchWorkspaces()
  succeed(
    context,
    context.t('dms_lang.workspace_rename.done', { name: renamed }),
  )
  await context.selectWorkspace(renamed, { replace: true })
  return renamed
}

/** Saves a workspace's details; a failure says why in a toast. */
async function updateDetails(
  context: WorkspaceActionsContext,
  id: string,
  change: DetailsChange,
): Promise<boolean> {
  const { workspaces } = context
  return context.failures.tryMutate(
    async () => workspaces.patchSummary(await workspaces.updateWorkspace(id, change)),
    { title: context.t('dms_lang.workspace_details.save_failed') },
  )
}

async function downloadBackup(
  context: WorkspaceActionsContext,
  workspace: string,
): Promise<void> {
  try {
    downloadJson(`${workspace}.json`, await context.workspaces.fetchBackup(workspace))
  } catch (error) {
    context.failures.reportFailure(error, {
      title: context.t('dms_lang.errors.export_failed'),
    })
  }
}

function deleteImpact(
  { t, formatCount, links }: WorkspaceActionsContext,
  workspace: string,
  impact: DeleteImpact,
) {
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

function backupButton(context: WorkspaceActionsContext, workspace: string) {
  return h(UButton, {
    icon: 'i-ph-download-simple',
    color: 'neutral',
    variant: 'outline',
    size: 'sm',
    class: 'self-start',
    label: context.t('dms_lang.workspace_delete.backup'),
    onClick: () => downloadBackup(context, workspace),
  })
}

async function deleteWorkspace(
  context: WorkspaceActionsContext,
  workspace: string,
  impact: DeleteImpact,
): Promise<boolean> {
  const { t, workspaces } = context
  const deleted = await context.confirm({
    title: t('dms_lang.workspace_delete.title', { name: workspace }),
    description: t('dms_lang.workspace_delete.description'),
    color: 'error',
    confirmLabel: t('dms_lang.workspace_delete.submit'),
    confirmText: workspace,
    impact: deleteImpact(context, workspace, impact),
    body: () => backupButton(context, workspace),
    onConfirm: async () => {
      await workspaces.deleteWorkspace(workspace)
      await workspaces.fetchWorkspaces()
    },
  })
  if (!deleted) return false
  succeed(context, t('dms_lang.workspace_delete.done', { name: workspace }))
  await context.selectWorkspace(DEFAULT_WORKSPACE, {
    page: 'workspaces',
    replace: true,
  })
  return true
}

/** Create, import, rename, back up and delete workspaces. */
export const useWorkspaceActions = () => {
  const context: WorkspaceActionsContext = {
    t: useI18n().t,
    toast: useToast(),
    overlay: useOverlay(),
    confirm: useConfirm().confirm,
    formatCount: useLangFormat().formatCount,
    workspaces: useI18nWorkspaces(),
    selectWorkspace: useWorkspaceRoute().selectWorkspace,
    failures: useMutationToast(),
    links: useLangLinks(),
  }
  return {
    createWorkspace: () => openCreate(context),
    importWorkspace: () => importWorkspace(context),
    renameWorkspace: (workspace: string) => renameWorkspace(context, workspace),
    updateDetails: (id: string, change: DetailsChange) =>
      updateDetails(context, id, change),
    deleteWorkspace: (workspace: string, impact: DeleteImpact) =>
      deleteWorkspace(context, workspace, impact),
    downloadBackup: (workspace: string) => downloadBackup(context, workspace),
  }
}
