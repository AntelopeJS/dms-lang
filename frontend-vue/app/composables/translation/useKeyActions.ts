import KeyAddModal from '../../build/components/KeyAddModal.vue'
import KeyRenameModal from '../../build/components/KeyRenameModal.vue'
import type { FlatTranslationRow, FlatTranslations } from '../../types/lang'

const FLAT_ENDPOINT = '/api/lang/translations/flat'

/** The written values of a row, without the languages it lacks. */
export function filledValues(row: FlatTranslationRow): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [locale, value] of Object.entries(row.values)) {
    if (!isLocaleValueMissing(value)) values[locale] = stringValue(value)
  }
  return values
}

/** Add, rename and delete translation keys of the selected workspace. */
export const useKeyActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  const { confirm } = useConfirm()
  const { $authFetch } = useAuthFetch()
  const {
    selectedWorkspace,
    deleteKey: removeKey,
    updateKey,
    createKey,
    revertOverride,
  } = useI18nWorkspaces()
  const { flat, reload } = useWorkspaceFlat()
  const { isDefault } = useWorkspaceContext()
  const { tryMutate } = useMutationToast()

  const existingKeys = computed(() => flat.value.rows.map((row) => row.key))

  /** The keys the installed modules provide, which the project files can override. */
  async function moduleRows(): Promise<FlatTranslationRow[]> {
    if (!isDefault.value) return []
    try {
      const modules = await $authFetch<Partial<FlatTranslations>>(
        FLAT_ENDPOINT,
        { query: { workspace: MODULES_WORKSPACE } },
      )
      return modules?.rows ?? []
    } catch {
      return []
    }
  }

  async function addKey(): Promise<string[]> {
    const modal = overlay.create(KeyAddModal, {
      props: {
        workspace: selectedWorkspace.value,
        baseLocale: flat.value.defaultLocale,
        locales: flat.value.locales,
        existingKeys: existingKeys.value,
        moduleRows: await moduleRows(),
      },
      destroyOnClose: true,
    })
    return ((await modal.open()) as string[] | undefined) ?? []
  }

  async function renameKey(path: string): Promise<string | null> {
    const modules = await moduleRows()
    const modal = overlay.create(KeyRenameModal, {
      props: {
        workspace: selectedWorkspace.value,
        path,
        languageCount: flat.value.locales.length,
        existingKeys: existingKeys.value,
        moduleKeys: modules.map((row) => row.key),
      },
      destroyOnClose: true,
    })
    const renamed = (await modal.open()) as string | null
    if (!renamed) return null
    await reload()
    toast.add({
      title: t('dms_lang.key_rename.done', { path: renamed }),
      color: 'success',
      icon: 'i-ph-check-circle',
    })
    return renamed
  }

  async function restoreKey(
    workspace: string,
    row: FlatTranslationRow,
    before?: string,
  ) {
    const ok = await tryMutate(() =>
      createKey(workspace, row.key, filledValues(row), before),
    )
    if (!ok) return
    await reload()
    toast.add({
      title: t('dms_lang.key_delete.restored', { path: row.key }),
      color: 'success',
      icon: 'i-ph-arrow-counter-clockwise',
    })
  }

  function announce(title: string, undo: () => Promise<void>): void {
    toast.add({
      title,
      color: 'neutral',
      icon: 'i-ph-trash',
      actions: [
        {
          label: t('dms_lang.actions.undo'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => undo(),
        },
      ],
    })
  }

  async function deleteKey(path: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const row = flat.value.rows.find((entry) => entry.key === path)
    const filled = row ? Object.keys(filledValues(row)) : []
    const before = nextSiblingPath(existingKeys.value, path)
    const deleted = await confirm({
      title: t('dms_lang.key_delete.title', { path }),
      description: t(
        'dms_lang.key_delete.description',
        { count: filled.length, locales: filled.join(', '), workspace },
        filled.length,
      ),
      color: 'error',
      confirmLabel: t('dms_lang.key_delete.submit'),
      onConfirm: async () => {
        await removeKey(workspace, path)
      },
    })
    if (!deleted) return false
    await reload()
    if (row)
      announce(t('dms_lang.key_delete.done', { path }), () =>
        restoreKey(workspace, row, before),
      )
    return true
  }

  async function restoreOverride(workspace: string, row: FlatTranslationRow) {
    const ok = await tryMutate(() =>
      updateKey(workspace, row.key, filledValues(row)),
    )
    if (ok) await reload()
  }

  /** Drops the project text of a module key: the module text shows again. */
  async function revertToModule(path: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const row = flat.value.rows.find((entry) => entry.key === path)
    const filled = row ? Object.keys(filledValues(row)) : []
    const reverted = await confirm({
      title: t('dms_lang.key_revert.title', { path }),
      description: t(
        'dms_lang.key_revert.description',
        { count: filled.length, locales: filled.join(', ') },
        filled.length,
      ),
      color: 'warning',
      confirmLabel: t('dms_lang.key_revert.submit'),
      onConfirm: async () => {
        await revertOverride(workspace, path)
      },
    })
    if (!reverted) return false
    await reload()
    if (row)
      announce(t('dms_lang.key_revert.done', { path }), () =>
        restoreOverride(workspace, row),
      )
    return true
  }

  return {
    addKey,
    renameKey,
    deleteKey,
    revertToModule,
  }
}
