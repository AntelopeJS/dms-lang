<script setup lang="ts">
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import { useDmsRouter } from '#dms/frontend-module'
import QueueActions from '../build/components/queue/QueueActions.vue'
import QueueDone from '../build/components/queue/QueueDone.vue'
import QueueEditor from '../build/components/queue/QueueEditor.vue'
import QueueHeader from '../build/components/queue/QueueHeader.vue'
import QueueUpNext from '../build/components/queue/QueueUpNext.vue'
import { provideQueue } from '../build/composables/useQueueContext'
import { useQueueEditing } from '../build/composables/useQueueEditing'
import { useQueueOrphans } from '../build/composables/useQueueOrphans'
import { useQueueSave } from '../build/composables/useQueueSave'
import { useQueueShortcuts } from '../build/composables/useQueueShortcuts'
import { useQueueToasts } from '../build/composables/useQueueToasts'
import { queueViewOf } from '../utils/queueView'

const UP_NEXT = 4
const URL_SYNC_MS = 400
const LANGUAGE_SUGGESTIONS = 6

defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const { selectedWorkspace } = useI18nWorkspaces()
const { flat, isLoaded } = useWorkspaceFlat()
useWorkspaceFlatSync()
const { canManage, isUnknown, isResolved, allows } = useWorkspaceContext()
const { nameAmong } = useLocaleNames()
const { removeLanguage, makeBase } = useLanguageActions()
const links = useLangLinks()
const router = useDmsRouter()
const toasts = useQueueToasts()
const session = useQueueSession(UP_NEXT)
const { locale, isBase, exists, current, isFinished } = session

const view = computed(() =>
  queueViewOf({
    isResolved: isResolved.value && isLoaded.value,
    exists: exists.value,
    isBase: isBase.value,
  }),
)
const nameOf = (code: string) => nameAmong(code, flat.value.locales)
const languageName = computed(() => nameOf(locale.value))
const editing = useQueueEditing(session)
const save = useQueueSave(session, editing, languageName)
const skip = () => toasts.showStep(session.skip())
provideQueue({ session, editing, save, languageName, nameOf, skip })
useQueueOrphans(session)
useUnsavedChanges({ dirty: () => session.drafts.count.value > 0 })

const root = useTemplateRef<HTMLElement>('root')
const editor = useTemplateRef<InstanceType<typeof QueueEditor>>('editor')
let urlTimer: ReturnType<typeof setTimeout> | undefined

const shortcuts = useQueueShortcuts(
  {
    isActive: () => !!current.value,
    saveNext: () => void save.save(),
    save: save.saveInPlace,
    skip,
    previous: () => session.previous(),
  },
  { root: () => root.value, field: () => editor.value?.field() },
)

const unknownActions = computed(() => [
  ...session.otherLanguages.value
    .slice(0, LANGUAGE_SUGGESTIONS)
    .map((code) => ({
      label: t('dms_lang.queue.unknown_pick', { name: nameOf(code) }),
      color: 'neutral' as const,
      variant: 'outline' as const,
      to: links.language(code),
    })),
  {
    label: t('dms_lang.queue.back'),
    icon: 'i-ph-arrow-left',
    color: 'neutral' as const,
    variant: 'ghost' as const,
    to: links.overview(),
  },
])

function remove() {
  return removeLanguage(locale.value, () => router.push(links.overview()))
}

/** Focuses the text of a new key, unless the focus is elsewhere on the page. */
function focusEditor() {
  const active = document.activeElement
  if (active && active !== document.body && !root.value?.contains(active))
    return
  editor.value?.focus()
}

watch(
  () => current.value?.key,
  async (key) => {
    clearTimeout(urlTimer)
    if (exists.value && !isBase.value)
      urlTimer = setTimeout(() => void session.syncKey(key ?? ''), URL_SYNC_MS)
    const shouldFocus = !shortcuts.isBrowsing()
    await nextTick()
    if (key && shouldFocus) focusEditor()
  },
)

function languageMenu() {
  const items = [
    [
      {
        label: t('dms_lang.languages.make_base'),
        icon: 'i-ph-star',
        onSelect: () => makeBase(locale.value),
      },
      {
        label: t('dms_lang.languages.remove'),
        icon: 'i-ph-trash',
        color: 'error',
        onSelect: remove,
      },
    ],
  ]
  return h(UDropdownMenu, { items, content: { align: 'end' } }, () =>
    h(UButton, {
      icon: 'i-ph-dots-three',
      color: 'neutral',
      variant: 'outline',
      'aria-label': t('dms_lang.queue.more'),
    }),
  )
}

const canManageLanguage = computed(
  () =>
    canManage.value &&
    allows('manageLanguages') &&
    exists.value &&
    !isBase.value,
)

usePageHeaderActions(() =>
  canManageLanguage.value ? languageMenu() : null,
)

onBeforeUnmount(() => clearTimeout(urlTimer))
</script>

<template>
  <template v-if="!isUnknown">
    <DmsCard v-if="view === 'loading'" padded>
      <div class="space-y-4">
        <USkeleton class="h-5 w-1/3" />
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>
    </DmsCard>

    <DmsEmptyState
      v-else-if="view === 'unknown'"
      :variant="locale ? 'no-result' : undefined"
      :icon="locale ? undefined : 'i-ph-translate'"
      size="lg"
      hatched
      :title="
        locale
          ? $t('dms_lang.queue.unknown_title', { code: locale })
          : $t('dms_lang.queue.pick_title')
      "
      :description="
        $t('dms_lang.queue.unknown_description', {
          workspace: selectedWorkspace,
        })
      "
      :actions="unknownActions"
    />

    <DmsEmptyState
      v-else-if="view === 'base'"
      icon="i-ph-star"
      tone="primary"
      size="lg"
      hatched
      :title="$t('dms_lang.queue.base_title', { name: languageName })"
      :description="$t('dms_lang.queue.base_description')"
      :actions="[
        {
          label: $t('dms_lang.queue.open_matrix'),
          icon: 'i-ph-table',
          color: 'neutral',
          variant: 'outline',
          to: links.translations(),
        },
      ]"
    />

    <DmsCard v-else :padded="false">
      <div ref="root">
        <QueueHeader />
        <QueueDone v-if="isFinished || !current" />
        <template v-else>
          <QueueEditor ref="editor" :row="current" />
          <QueueActions />
          <QueueUpNext />
        </template>
      </div>
    </DmsCard>
  </template>
</template>
