import { until } from '@vueuse/core'
import { useDmsState } from '#dms/frontend-module'
import LanguageAddModal from '../../build/components/LanguageAddModal.vue'

interface BaseImpact {
  missing: number
  keys: string[]
}

const LANGUAGES_API = '/api/lang/translations/languages'
const LISTED_KEYS = 5

/** Add, remove and make base a language of the selected workspace. */
export const useLanguageActions = () => {
  const { t } = useI18n()
  const toast = useToast()
  const overlay = useOverlay()
  /** Settles once every closed dialog has finished leaving the screen. */
  const dialogsLeft = () =>
    until(() =>
      overlay.overlays.some((entry) => entry.isMounted && !entry.isOpen),
    ).toBe(false)
  const { confirm } = useConfirm()
  const { $authFetch } = useAuthFetch()
  const { formatCount } = useLangFormat()
  const { reportFailure } = useMutationToast()
  const { selectedWorkspace, removeLocale, setDefaultLocale } =
    useI18nWorkspaces()
  const { canManage } = useWorkspaceContext()
  const { flat, reload } = useWorkspaceFlat()
  const { nativeName } = useLocaleNames()
  const links = useLangLinks()
  const isAddOpen = useDmsState<boolean>(
    'dms-lang-add-language-open',
    () => false,
  )

  function notify(title: string) {
    toast.add({ title, color: 'success', icon: 'i-ph-check-circle' })
  }

  function explainLocked(): void {
    toast.add({
      title: t('dms_lang.language_add.locked_title'),
      description: t('dms_lang.language_add.locked'),
      color: 'warning',
      icon: 'i-ph-lock-simple',
    })
  }

  async function openAddModal(): Promise<boolean> {
    isAddOpen.value = true
    try {
      const modal = overlay.create(LanguageAddModal, {
        props: {
          workspace: selectedWorkspace.value,
          existing: flat.value.locales,
          baseName: nativeName(flat.value.defaultLocale),
        },
      })
      return (await modal.open()) === true
    } finally {
      isAddOpen.value = false
    }
  }

  async function addLanguage(): Promise<boolean> {
    if (!canManage.value) {
      explainLocked()
      return false
    }
    if (isAddOpen.value) return false
    const before = new Set(flat.value.locales)
    if (!(await openAddModal())) return false
    await reload()
    const code = flat.value.locales.find((locale) => !before.has(locale))
    if (code) {
      notify(
        t(
          'dms_lang.language_add.done',
          {
            name: nativeName(code),
            code,
            count: formatCount(flat.value.totalKeys),
          },
          flat.value.totalKeys,
        ),
      )
    }
    return true
  }

  function translatedOf(code: string): number {
    return flat.value.rows.filter(
      (row) => !isLocaleValueMissing(row.values[code]),
    ).length
  }

  /**
   * Asks, then removes a language. `afterRemove` runs once the dialog has
   * closed (the Language page leaves for the overview there), before the
   * data of the page is reloaded.
   */
  async function removeLanguage(
    code: string,
    afterRemove?: () => Promise<unknown>,
  ): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const removed = await confirm({
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
      },
    })
    if (!removed) return false
    notify(t('dms_lang.language_remove.done'))
    await dialogsLeft()
    await afterRemove?.()
    await reload()
    return true
  }

  /** The keys without a text in a language, as the server counts them; none when it refused. */
  async function baseImpact(
    workspace: string,
    code: string,
  ): Promise<BaseImpact | null> {
    try {
      return await $authFetch<BaseImpact>(
        `${LANGUAGES_API}/${encodeURIComponent(workspace)}/${encodeURIComponent(code)}/base-confirm`,
      )
    } catch (error) {
      reportFailure(error)
      return null
    }
  }

  function impactNote(impact: BaseImpact, name: string): string {
    if (!impact.missing) {
      return t('dms_lang.language_base.confirm_complete', { name })
    }
    return t(
      'dms_lang.language_base.confirm_missing',
      { count: formatCount(impact.missing), name },
      impact.missing,
    )
  }

  function impactBody(impact: BaseImpact, name: string) {
    const listed = impact.keys.slice(0, LISTED_KEYS)
    const more = impact.missing - listed.length
    const moreLabel = t(
      'dms_lang.language_base.confirm_more',
      { n: formatCount(more) },
      more,
    )
    return h('div', { class: 'space-y-2 text-sm' }, [
      h('p', { class: 'text-muted' }, impactNote(impact, name)),
      listed.length
        ? h('ul', { class: 'text-muted space-y-0.5 font-mono text-xs' }, [
            ...listed.map((key) => h('li', { class: 'truncate' }, key)),
            more > 0 ? h('li', moreLabel) : null,
          ])
        : null,
    ])
  }

  /**
   * Makes a language the base of the workspace, once the user saw which keys
   * have no text in it: they show as missing in the base afterwards.
   */
  async function makeBase(code: string): Promise<boolean> {
    const workspace = selectedWorkspace.value
    const name = nativeName(code)
    const impact = await baseImpact(workspace, code)
    if (!impact) return false
    const confirmed = await confirm({
      title: t('dms_lang.language_base.confirm_title', { name }),
      description: t('dms_lang.language_base.confirm_description', { name }),
      color: impact.missing ? 'warning' : 'primary',
      icon: 'i-ph-star',
      confirmLabel: t('dms_lang.language_base.confirm_submit'),
      body: () => impactBody(impact, name),
      onConfirm: async () => {
        await setDefaultLocale(workspace, code)
      },
    })
    if (!confirmed) return false
    await reload()
    notify(t('dms_lang.language_base.done', { name }))
    return true
  }

  return { addLanguage, removeLanguage, makeBase }
}
