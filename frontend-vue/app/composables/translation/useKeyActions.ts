import KeyAddModal from '../../build/components/KeyAddModal.vue'
import KeyRenameModal from '../../build/components/KeyRenameModal.vue'
import type { FlatTranslationRow } from '../../types/lang'

/** Add, rename and delete translation keys of the selected workspace. */
export const useKeyActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  const { confirm } = useConfirm()
  const {
    selectedWorkspace,
    deleteKey: removeKey,
    upsertKey,
  } = useI18nWorkspaces()
  const { flat, reload } = useWorkspaceFlat()
  const { nativeName } = useLocaleNames()
  const { tryMutate } = useMutationToast()

  const existingKeys = computed(() => flat.value.rows.map((row) => row.key))

  async function addKey(): Promise<string[]> {
    const modal = overlay.create(KeyAddModal, {
      props: {
        workspace: selectedWorkspace.value,
        baseLocale: flat.value.defaultLocale,
        baseName: nativeName(flat.value.defaultLocale),
        existingKeys: existingKeys.value,
      },
    })
    const added = ((await modal.open()) as string[] | undefined) ?? []
    if (added.length) await reload()
    return added
  }

  async function renameKey(path: string): Promise<string | null> {
    const modal = overlay.create(KeyRenameModal, {
      props: {
        workspace: selectedWorkspace.value,
        path,
        languageCount: flat.value.locales.length,
        existingKeys: existingKeys.value,
      },
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

  function filledValues(row: FlatTranslationRow): Record<string, string> {
    const values: Record<string, string> = {}
    for (const [locale, value] of Object.entries(row.values)) {
      if (!isLocaleValueMissing(value)) values[locale] = stringValue(value)
    }
    return values
  }

  async function restoreKey(workspace: string, row: FlatTranslationRow) {
    const ok = await tryMutate(() =>
      upsertKey(
        workspace,
        row.key,
        filledValues(row),
        flat.value.defaultLocale,
      ),
    )
    if (!ok) return
    await reload()
    toast.add({
      title: t('dms_lang.key_delete.restored', { path: row.key }),
      color: 'success',
      icon: 'i-ph-arrow-counter-clockwise',
    })
  }

  function announceDeleted(workspace: string, row: FlatTranslationRow): void {
    toast.add({
      title: t('dms_lang.key_delete.done', { path: row.key }),
      color: 'neutral',
      icon: 'i-ph-trash',
      actions: [
        {
          label: t('dms_lang.actions.undo'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => restoreKey(workspace, row),
        },
      ],
    })
  }

  async function deleteKey(path: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const row = flat.value.rows.find((entry) => entry.key === path)
    const filled = row ? Object.keys(filledValues(row)) : []
    const deleted = await confirm({
      title: t('dms_lang.key_delete.title', { path }),
      description: t('dms_lang.key_delete.description', {
        count: filled.length,
        locales: filled.join(', '),
        workspace,
      }),
      color: 'error',
      confirmLabel: t('dms_lang.key_delete.submit'),
      onConfirm: async () => {
        await removeKey(workspace, path)
      },
    })
    if (!deleted) return false
    await reload()
    if (row) announceDeleted(workspace, row)
    return true
  }

  return { addKey, renameKey, deleteKey, existingKeys }
}
