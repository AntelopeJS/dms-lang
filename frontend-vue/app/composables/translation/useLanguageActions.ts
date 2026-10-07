import LanguageAddModal from '../../build/components/LanguageAddModal.vue'

/** Add, remove and make base a language of the selected workspace. */
export const useLanguageActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  const { confirm } = useConfirm()
  const { formatCount } = useLangFormat()
  const { selectedWorkspace, fetchWorkspaces, removeLocale, setDefaultLocale } =
    useI18nWorkspaces()
  const { canManage } = useWorkspaceContext()
  const { flat, reload } = useWorkspaceFlat()
  const { nativeName } = useLocaleNames()
  const { tryMutate } = useMutationToast()
  const links = useLangLinks()

  async function refresh(): Promise<void> {
    await Promise.all([fetchWorkspaces(), reload()])
  }

  function explainLocked(): void {
    toast.add({
      title: t('dms_lang.language_add.locked_title'),
      description: t('dms_lang.language_add.locked'),
      color: 'warning',
      icon: 'i-ph-lock-simple',
    })
  }

  async function addLanguage(): Promise<boolean> {
    if (!canManage.value) {
      explainLocked()
      return false
    }
    const before = new Set(flat.value.locales)
    const modal = overlay.create(LanguageAddModal, {
      props: {
        workspace: selectedWorkspace.value,
        existing: flat.value.locales,
        baseName: nativeName(flat.value.defaultLocale),
      },
    })
    const added = (await modal.open()) === true
    if (!added) return false
    await refresh()
    const code = flat.value.locales.find((locale) => !before.has(locale))
    if (code) {
      toast.add({
        title: t('dms_lang.language_add.done', {
          name: nativeName(code),
          code,
          count: formatCount(flat.value.totalKeys),
        }),
        color: 'success',
        icon: 'i-ph-check-circle',
      })
    }
    return true
  }

  function translatedOf(code: string): number {
    return flat.value.rows.filter(
      (row) => !isLocaleValueMissing(row.values[code]),
    ).length
  }

  async function removeLanguage(code: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    return confirm({
      title: t('dms_lang.language_remove.title', {
        name: nativeName(code),
        workspace,
      }),
      description: t('dms_lang.language_remove.description', {
        url: links.publicLocaleUrl(workspace, code),
      }),
      color: 'error',
      confirmLabel: t('dms_lang.language_remove.submit'),
      confirmText: code,
      impact: [
        {
          icon: 'i-ph-file',
          label: t('dms_lang.language_remove.file', { file: `${code}.json` }),
        },
        {
          icon: 'i-ph-text-aa',
          label: t('dms_lang.language_remove.strings'),
          count: formatCount(translatedOf(code)),
        },
      ],
      onConfirm: async () => {
        await removeLocale(workspace, code)
        await refresh()
      },
    })
  }

  async function makeBase(code: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const ok = await tryMutate(() => setDefaultLocale(workspace, code))
    if (!ok) return false
    await refresh()
    toast.add({
      title: t('dms_lang.language_base.done', { name: nativeName(code) }),
      color: 'success',
      icon: 'i-ph-check-circle',
    })
    return true
  }

  return { addLanguage, removeLanguage, makeBase }
}
