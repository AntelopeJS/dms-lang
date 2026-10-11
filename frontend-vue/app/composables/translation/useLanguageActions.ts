import type { Ref } from 'vue'
import { until } from '@vueuse/core'
import { useDmsState } from '#dms/frontend-module'
import LanguageAddModal from '../../build/components/LanguageAddModal.vue'

interface BaseImpact {
  missing: number
  keys: string[]
}

/** What the language actions share: the selected workspace, its translations and the DMS helpers. */
interface LanguageActionsContext {
  t: ReturnType<typeof useI18n>['t']
  toast: ReturnType<typeof useToast>
  overlay: ReturnType<typeof useOverlay>
  confirm: ReturnType<typeof useConfirm>['confirm']
  authFetch: ReturnType<typeof useAuthFetch>['$authFetch']
  formatCount: ReturnType<typeof useLangFormat>['formatCount']
  reportFailure: ReturnType<typeof useMutationToast>['reportFailure']
  workspaces: ReturnType<typeof useI18nWorkspaces>
  translations: ReturnType<typeof useWorkspaceFlat>
  canManage: Ref<boolean>
  nativeName: (code: string) => string
  links: ReturnType<typeof useLangLinks>
  isAddOpen: Ref<boolean>
}

const LANGUAGES_API = '/api/lang/translations/languages'
const LISTED_KEYS = 5

function notify(context: LanguageActionsContext, title: string) {
  context.toast.add({ title, color: 'success', icon: 'i-ph-check-circle' })
}

/** Settles once every closed dialog has finished leaving the screen. */
function dialogsLeft(context: LanguageActionsContext): Promise<boolean> {
  const { overlays } = context.overlay
  return until(() =>
    overlays.some((entry) => entry.isMounted && !entry.isOpen),
  ).toBe(false)
}

function explainLocked({ t, toast }: LanguageActionsContext): void {
  toast.add({
    title: t('dms_lang.language_add.locked_title'),
    description: t('dms_lang.language_add.locked'),
    color: 'warning',
    icon: 'i-ph-lock-simple',
  })
}

async function openAddModal(context: LanguageActionsContext): Promise<boolean> {
  const { flat } = context.translations
  context.isAddOpen.value = true
  try {
    const modal = context.overlay.create(LanguageAddModal, {
      props: {
        workspace: context.workspaces.selectedWorkspace.value,
        existing: flat.value.locales,
        baseName: context.nativeName(flat.value.defaultLocale),
      },
    })
    return (await modal.open()) === true
  } finally {
    context.isAddOpen.value = false
  }
}

async function addLanguage(context: LanguageActionsContext): Promise<boolean> {
  if (!context.canManage.value) {
    explainLocked(context)
    return false
  }
  if (context.isAddOpen.value) return false
  const { flat, reload } = context.translations
  const before = new Set(flat.value.locales)
  if (!(await openAddModal(context))) return false
  await reload()
  const code = flat.value.locales.find((locale) => !before.has(locale))
  if (!code) return true
  const total = flat.value.totalKeys
  const params = {
    name: context.nativeName(code),
    code,
    count: context.formatCount(total),
  }
  notify(context, context.t('dms_lang.language_add.done', params, total))
  return true
}

function removalImpact(context: LanguageActionsContext, code: string) {
  const { t, formatCount } = context
  const translated = context.translations.flat.value.rows.filter(
    (row) => !isLocaleValueMissing(row.values[code]),
  ).length
  return [
    {
      icon: 'i-ph-file',
      label: t('dms_lang.language_remove.file', { file: `${code}.json` }),
    },
    {
      icon: 'i-ph-text-aa',
      label: t('dms_lang.language_remove.strings'),
      count: formatCount(translated),
    },
  ]
}

/**
 * Asks, then removes a language. `afterRemove` runs once the dialog has
 * left the screen (the Language page leaves for the overview there), before
 * the data of the page is reloaded.
 */
async function removeLanguage(
  context: LanguageActionsContext,
  code: string,
  afterRemove?: () => Promise<unknown>,
): Promise<boolean> {
  const { t } = context
  const workspace = context.workspaces.selectedWorkspace.value
  const removed = await context.confirm({
    title: t('dms_lang.language_remove.title', {
      name: context.nativeName(code),
      workspace,
    }),
    description: t('dms_lang.language_remove.description', {
      url: context.links.publicLocaleUrl(workspace, code),
    }),
    color: 'error',
    confirmLabel: t('dms_lang.language_remove.submit'),
    confirmText: code,
    impact: removalImpact(context, code),
    onConfirm: async () => {
      await context.workspaces.removeLocale(workspace, code)
    },
  })
  if (!removed) return false
  notify(context, t('dms_lang.language_remove.done'))
  await dialogsLeft(context)
  await afterRemove?.()
  await context.translations.reload()
  return true
}

/** The keys without a text in a language, as the server counts them; none when it refused. */
async function baseImpact(
  context: LanguageActionsContext,
  workspace: string,
  code: string,
): Promise<BaseImpact | null> {
  try {
    return await context.authFetch<BaseImpact>(
      `${LANGUAGES_API}/${encodeURIComponent(workspace)}/${encodeURIComponent(code)}/base-confirm`,
    )
  } catch (error) {
    context.reportFailure(error)
    return null
  }
}

function impactNote(
  { t, formatCount }: LanguageActionsContext,
  impact: BaseImpact,
  name: string,
): string {
  if (!impact.missing)
    return t('dms_lang.language_base.confirm_complete', { name })
  return t(
    'dms_lang.language_base.confirm_missing',
    { count: formatCount(impact.missing), name },
    impact.missing,
  )
}

function impactBody(
  context: LanguageActionsContext,
  impact: BaseImpact,
  name: string,
) {
  const listed = impact.keys.slice(0, LISTED_KEYS)
  const more = impact.missing - listed.length
  const moreLabel = context.t(
    'dms_lang.language_base.confirm_more',
    { n: context.formatCount(more) },
    more,
  )
  return h('div', { class: 'space-y-2 text-sm' }, [
    h('p', { class: 'text-muted' }, impactNote(context, impact, name)),
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
async function makeBase(
  context: LanguageActionsContext,
  code: string,
): Promise<boolean> {
  const { t } = context
  const workspace = context.workspaces.selectedWorkspace.value
  const name = context.nativeName(code)
  const impact = await baseImpact(context, workspace, code)
  if (!impact) return false
  const confirmed = await context.confirm({
    title: t('dms_lang.language_base.confirm_title', { name }),
    description: t('dms_lang.language_base.confirm_description', { name }),
    color: impact.missing ? 'warning' : 'primary',
    icon: 'i-ph-star',
    confirmLabel: t('dms_lang.language_base.confirm_submit'),
    body: () => impactBody(context, impact, name),
    onConfirm: async () => {
      await context.workspaces.setDefaultLocale(workspace, code)
    },
  })
  if (!confirmed) return false
  await context.translations.reload()
  notify(context, t('dms_lang.language_base.done', { name }))
  return true
}

/** Add, remove and make base a language of the selected workspace. */
export const useLanguageActions = () => {
  const context: LanguageActionsContext = {
    t: useI18n().t,
    toast: useToast(),
    overlay: useOverlay(),
    confirm: useConfirm().confirm,
    authFetch: useAuthFetch().$authFetch,
    formatCount: useLangFormat().formatCount,
    reportFailure: useMutationToast().reportFailure,
    workspaces: useI18nWorkspaces(),
    translations: useWorkspaceFlat(),
    canManage: useWorkspaceContext().canManage,
    nativeName: useLocaleNames().nativeName,
    links: useLangLinks(),
    isAddOpen: useDmsState<boolean>('dms-lang-add-language-open', () => false),
  }
  return {
    addLanguage: () => addLanguage(context),
    removeLanguage: (code: string, afterRemove?: () => Promise<unknown>) =>
      removeLanguage(context, code, afterRemove),
    makeBase: (code: string) => makeBase(context, code),
  }
}
