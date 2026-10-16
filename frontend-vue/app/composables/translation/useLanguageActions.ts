import type { Ref } from 'vue'
import { until } from '@vueuse/core'
import { useDmsState } from '#dms/frontend-module'
import LanguageAddModal from '../../build/components/LanguageAddModal.vue'

/** What the language actions share: the selected workspace and the DMS helpers. */
interface LanguageActionsContext {
  t: ReturnType<typeof useI18n>['t']
  toast: ReturnType<typeof useToast>
  overlay: ReturnType<typeof useOverlay>
  confirmFrom: ReturnType<typeof useConfirmFrom>['confirmFrom']
  formatCount: ReturnType<typeof useLangFormat>['formatCount']
  workspaces: ReturnType<typeof useI18nWorkspaces>
  translations: ReturnType<typeof useWorkspaceFlat>
  current: ReturnType<typeof useWorkspaceContext>['current']
  canManage: Ref<boolean>
  nativeName: (code: string) => string
  isAddOpen: Ref<boolean>
}

const REMOVAL_CONFIRM = 'removal-confirm'
const BASE_CONFIRM = 'base-confirm'

function notify(context: LanguageActionsContext, title: string) {
  context.toast.add({ title, color: 'success', icon: 'i-ph-check-circle' })
}

function codesOf(context: LanguageActionsContext): string[] {
  return context.current.value?.locales.map((locale) => locale.code) ?? []
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
  context.isAddOpen.value = true
  try {
    const modal = context.overlay.create(LanguageAddModal, {
      props: {
        workspace: context.workspaces.selectedWorkspace.value,
        existing: codesOf(context),
        baseName: context.nativeName(context.current.value?.defaultLocale ?? ''),
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
  const before = new Set(codesOf(context))
  if (!(await openAddModal(context))) return false
  await context.translations.refresh()
  const code = codesOf(context).find((locale) => !before.has(locale))
  if (!code) return true
  const total = context.current.value?.totalKeys ?? 0
  const params = {
    name: context.nativeName(code),
    code,
    count: context.formatCount(total),
  }
  notify(context, context.t('dms_lang.language_add.done', params, total))
  return true
}

function languageRoute(context: LanguageActionsContext, code: string): string {
  return languageUrl(context.workspaces.selectedWorkspace.value, code)
}

/**
 * Asks with the server's dialog, then removes a language. `afterRemove`
 * runs once the dialog has left the screen (the Language page leaves for
 * the overview there), before the data of the page is read again.
 */
async function removeLanguage(
  context: LanguageActionsContext,
  code: string,
  afterRemove?: () => Promise<unknown>,
): Promise<boolean> {
  const workspace = context.workspaces.selectedWorkspace.value
  const route = languageRoute(context, code)
  const removed = await context.confirmFrom(`${route}/${REMOVAL_CONFIRM}`, {
    onConfirm: async () => {
      await context.workspaces.removeLocale(workspace, code)
    },
  })
  if (!removed) return false
  notify(context, context.t('dms_lang.language_remove.done'))
  await dialogsLeft(context)
  await afterRemove?.()
  await context.translations.refresh()
  return true
}

/**
 * Makes a language the base of the workspace, once the user saw in the
 * server's dialog which keys have no text in it: they show as missing in
 * the base afterwards.
 */
async function makeBase(
  context: LanguageActionsContext,
  code: string,
): Promise<boolean> {
  const workspace = context.workspaces.selectedWorkspace.value
  const route = languageRoute(context, code)
  const confirmed = await context.confirmFrom(`${route}/${BASE_CONFIRM}`, {
    onConfirm: async () => {
      await context.workspaces.setDefaultLocale(workspace, code)
    },
  })
  if (!confirmed) return false
  await context.translations.refresh()
  notify(
    context,
    context.t('dms_lang.language_base.done', { name: context.nativeName(code) }),
  )
  return true
}

/** Add, remove and make base a language of the selected workspace. */
export const useLanguageActions = () => {
  const { current, canManage } = useWorkspaceContext()
  const context: LanguageActionsContext = {
    t: useI18n().t,
    toast: useToast(),
    overlay: useOverlay(),
    confirmFrom: useConfirmFrom().confirmFrom,
    formatCount: useLangFormat().formatCount,
    workspaces: useI18nWorkspaces(),
    translations: useWorkspaceFlat(),
    current,
    canManage,
    nativeName: useLocaleNames().nativeName,
    isAddOpen: useDmsState<boolean>('dms-lang-add-language-open', () => false),
  }
  return {
    addLanguage: () => addLanguage(context),
    removeLanguage: (code: string, afterRemove?: () => Promise<unknown>) =>
      removeLanguage(context, code, afterRemove),
    makeBase: (code: string) => makeBase(context, code),
  }
}
