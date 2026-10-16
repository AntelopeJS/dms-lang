import KeyAddModal from '../../build/components/KeyAddModal.vue'
import KeyRenameModal from '../../build/components/KeyRenameModal.vue'
import type { FlatTranslationRow, KeyRowResponse } from '../../types/lang'

/** What the key actions share: the selected workspace, its keys and the DMS helpers. */
interface KeyActionsContext {
  t: ReturnType<typeof useI18n>['t']
  toast: ReturnType<typeof useToast>
  overlay: ReturnType<typeof useOverlay>
  confirm: ReturnType<typeof useConfirm>['confirm']
  workspaces: ReturnType<typeof useI18nWorkspaces>
  translations: ReturnType<typeof useWorkspaceFlat>
  isDefault: ReturnType<typeof useWorkspaceContext>['isDefault']
  tryMutate: ReturnType<typeof useMutationToast>['tryMutate']
}

/** A removal asked about in a dialog, then announced with an Undo. */
interface KeyRemoval {
  path: string
  /** The group of its texts (`key_delete`, `key_revert`). */
  texts: string
  color: 'error' | 'warning'
  run: (workspace: string) => Promise<KeyRowResponse>
  undo: (workspace: string, row: FlatTranslationRow) => Promise<void>
}

/** The written values of a row, without the languages it lacks. */
export function filledValues(row: FlatTranslationRow): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [locale, value] of Object.entries(row.values)) {
    if (!isLocaleValueMissing(value)) values[locale] = stringValue(value)
  }
  return values
}

function rowsOf(context: KeyActionsContext): FlatTranslationRow[] {
  return context.translations.flat.value.rows
}

/** The keys the installed modules provide, which the project files can override. */
async function moduleRows(
  context: KeyActionsContext,
): Promise<FlatTranslationRow[]> {
  if (!context.isDefault.value) return []
  return (await context.translations.loadModules()).rows
}

async function addKey(context: KeyActionsContext): Promise<string[]> {
  const { flat } = context.translations
  const modal = context.overlay.create(KeyAddModal, {
    props: {
      workspace: context.workspaces.selectedWorkspace.value,
      baseLocale: flat.value.defaultLocale,
      locales: flat.value.locales,
      existingKeys: rowsOf(context).map((row) => row.key),
      moduleRows: await moduleRows(context),
    },
    destroyOnClose: true,
  })
  return ((await modal.open()) as string[] | undefined) ?? []
}

function notify(context: KeyActionsContext, title: string, icon: string) {
  context.toast.add({ title, color: 'success', icon })
}

async function renameKey(
  context: KeyActionsContext,
  path: string,
): Promise<string | null> {
  const modules = await moduleRows(context)
  const modal = context.overlay.create(KeyRenameModal, {
    props: {
      workspace: context.workspaces.selectedWorkspace.value,
      path,
      languageCount: context.translations.flat.value.locales.length,
      existingKeys: rowsOf(context).map((row) => row.key),
      moduleKeys: modules.map((row) => row.key),
    },
    destroyOnClose: true,
  })
  const renamed = (await modal.open()) as string | null
  if (!renamed) return null
  notify(
    context,
    context.t('dms_lang.key_rename.done', { path: renamed }),
    'i-ph-check-circle',
  )
  return renamed
}

function announceRemoval(
  context: KeyActionsContext,
  title: string,
  undo: () => Promise<void>,
): void {
  context.toast.add({
    title,
    color: 'neutral',
    icon: 'i-ph-trash',
    actions: [
      {
        label: context.t('dms_lang.actions.undo'),
        color: 'neutral',
        variant: 'outline',
        onClick: () => undo(),
      },
    ],
  })
}

/** Asks, runs a removal, puts its answer in place, and offers to undo it with the row as it was. */
async function removeKeyTexts(
  context: KeyActionsContext,
  removal: KeyRemoval,
): Promise<boolean> {
  const { t } = context
  const workspace = context.workspaces.selectedWorkspace.value
  const row = rowsOf(context).find((entry) => entry.key === removal.path)
  const filled = row ? Object.keys(filledValues(row)) : []
  const count = filled.length
  const params = {
    path: removal.path,
    workspace,
    count,
    locales: filled.join(', '),
  }
  const removed = await context.confirm({
    title: t(`dms_lang.${removal.texts}.title`, params),
    description: t(`dms_lang.${removal.texts}.description`, params, count),
    color: removal.color,
    confirmLabel: t(`dms_lang.${removal.texts}.submit`),
    onConfirm: async () => {
      const response = await removal.run(workspace)
      context.translations.applyRow(workspace, removal.path, response)
    },
  })
  if (!removed) return false
  if (row)
    announceRemoval(context, t(`dms_lang.${removal.texts}.done`, params), () =>
      removal.undo(workspace, row),
    )
  return true
}

/** The row a removal took away, written back where it was. */
interface RowRestore {
  workspace: string
  row: FlatTranslationRow
  before?: string
}

/** Writes a row back as it was and puts the answer in place. */
async function restoreRow(
  context: KeyActionsContext,
  { workspace, row, before }: RowRestore,
  write: () => Promise<KeyRowResponse>,
): Promise<boolean> {
  return context.tryMutate(async () => {
    const response = await write()
    context.translations.applyRow(workspace, row.key, response, before)
  })
}

function deleteKey(context: KeyActionsContext, path: string) {
  const { deleteKey: remove, createKey } = context.workspaces
  const before = nextSiblingPath(
    rowsOf(context).map((row) => row.key),
    path,
  )
  return removeKeyTexts(context, {
    path,
    texts: 'key_delete',
    color: 'error',
    run: (workspace) => remove(workspace, path),
    undo: async (workspace, row) => {
      const write = () =>
        createKey(workspace, row.key, filledValues(row), before)
      if (!(await restoreRow(context, { workspace, row, before }, write)))
        return
      notify(
        context,
        context.t('dms_lang.key_delete.restored', { path: row.key }),
        'i-ph-arrow-counter-clockwise',
      )
    },
  })
}

/** Drops the project text of a module key: the module text shows again. */
function revertToModule(context: KeyActionsContext, path: string) {
  const { revertOverride, updateKey } = context.workspaces
  return removeKeyTexts(context, {
    path,
    texts: 'key_revert',
    color: 'warning',
    run: (workspace) => revertOverride(workspace, path),
    undo: async (workspace, row) => {
      await restoreRow(context, { workspace, row }, () =>
        updateKey(workspace, row.key, filledValues(row)),
      )
    },
  })
}

/** Add, rename and delete translation keys of the selected workspace. */
export const useKeyActions = () => {
  const context: KeyActionsContext = {
    t: useI18n().t,
    toast: useToast(),
    overlay: useOverlay(),
    confirm: useConfirm().confirm,
    workspaces: useI18nWorkspaces(),
    translations: useWorkspaceFlat(),
    isDefault: useWorkspaceContext().isDefault,
    tryMutate: useMutationToast().tryMutate,
  }
  return {
    addKey: () => addKey(context),
    renameKey: (path: string) => renameKey(context, path),
    deleteKey: (path: string) => deleteKey(context, path),
    revertToModule: (path: string) => revertToModule(context, path),
  }
}
